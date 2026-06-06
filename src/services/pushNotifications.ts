import { Capacitor } from "@capacitor/core";

type PushPermissionStatus = {
    receive?: string;
};

type PushListenerHandle = {
    remove: () => Promise<void> | void;
};

type PushNotificationsPlugin = {
    requestPermissions: () => Promise<PushPermissionStatus>;
    register: () => Promise<void>;
    addListener: (
        eventName: "registration" | "registrationError",
        listenerFunc: (event: unknown) => void,
    ) => Promise<PushListenerHandle> | PushListenerHandle;
};

type SupabasePushTokenClient = {
    from: (table: "notification_push_tokens") => {
        upsert: (
            values: Record<string, unknown>,
            options?: { onConflict?: string },
        ) => PromiseLike<{ error: { message?: string } | null }>;
    };
};

export type PushPlatform = "android" | "ios" | "web";

export type RegisterPushOptions = {
    peerId: string | null | undefined;
    supabase: SupabasePushTokenClient;
    plugin?: PushNotificationsPlugin | null;
    platform?: PushPlatform;
    timeoutMs?: number;
};

export type RegisterPushResult =
    | { status: "registered"; token: string; platform: PushPlatform }
    | { status: "denied"; reason: string }
    | { status: "skipped"; reason: string }
    | { status: "unavailable"; reason: string };

function getGlobalPushNotificationsPlugin(): PushNotificationsPlugin | null {
    const globalWithCapacitor = globalThis as typeof globalThis & {
        Capacitor?: {
            Plugins?: {
                PushNotifications?: PushNotificationsPlugin;
            };
        };
    };

    return globalWithCapacitor.Capacitor?.Plugins?.PushNotifications ?? null;
}

export function detectPushPlatform(): PushPlatform {
    const platform = Capacitor.getPlatform();
    if (platform === "android" || platform === "ios") return platform;
    return "web";
}

function extractTokenValue(event: unknown): string | null {
    if (typeof event === "string" && event.trim()) return event;

    if (event && typeof event === "object") {
        const tokenEvent = event as { value?: unknown; token?: unknown };
        if (typeof tokenEvent.value === "string" && tokenEvent.value.trim()) return tokenEvent.value;
        if (typeof tokenEvent.token === "string" && tokenEvent.token.trim()) return tokenEvent.token;
    }

    return null;
}

function toError(error: unknown): Error {
    if (error instanceof Error) return error;
    if (error && typeof error === "object") {
        const maybeError = error as { message?: unknown; error?: unknown };
        if (typeof maybeError.message === "string") return new Error(maybeError.message);
        if (typeof maybeError.error === "string") return new Error(maybeError.error);
    }
    return new Error("push_registration_failed");
}

async function removeListener(handle: PushListenerHandle | null) {
    if (!handle) return;
    await handle.remove();
}

export async function registerForPushNotifications({
    peerId,
    supabase,
    plugin = getGlobalPushNotificationsPlugin(),
    platform = detectPushPlatform(),
    timeoutMs = 15000,
}: RegisterPushOptions): Promise<RegisterPushResult> {
    if (!peerId) {
        return { status: "skipped", reason: "missing_peer_id" };
    }

    if (!plugin) {
        return { status: "unavailable", reason: "push_plugin_unavailable" };
    }

    const permission = await plugin.requestPermissions();
    if (permission.receive !== "granted") {
        return { status: "denied", reason: "push_permission_denied" };
    }

    let registrationHandle: PushListenerHandle | null = null;
    let errorHandle: PushListenerHandle | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const tokenPromise = new Promise<string>((resolve, reject) => {
        const finish = (callback: () => void) => {
            if (settled) return;
            settled = true;
            if (timeoutId) clearTimeout(timeoutId);
            callback();
        };

        timeoutId = setTimeout(() => {
            finish(() => reject(new Error("push_registration_timeout")));
        }, timeoutMs);

        Promise.resolve(
            plugin.addListener("registration", (event) => {
                const token = extractTokenValue(event);
                finish(() => {
                    if (token) {
                        resolve(token);
                    } else {
                        reject(new Error("push_token_missing"));
                    }
                });
            }),
        )
            .then((handle) => {
                registrationHandle = handle;
                return Promise.resolve(
                    plugin.addListener("registrationError", (event) => {
                        finish(() => reject(toError(event)));
                    }),
                );
            })
            .then((handle) => {
                errorHandle = handle;
                return plugin.register();
            })
            .catch((error: unknown) => {
                finish(() => reject(toError(error)));
            });
    });

    try {
        const token = await tokenPromise;
        const now = new Date().toISOString();
        const { error } = await supabase.from("notification_push_tokens").upsert(
            {
                peer_id: peerId,
                token,
                platform,
                provider: "fcm",
                enabled: true,
                last_seen_at: now,
                updated_at: now,
            },
            { onConflict: "token" },
        );

        if (error) {
            throw new Error(error.message || "push_token_upsert_failed");
        }

        return { status: "registered", token, platform };
    } finally {
        await Promise.all([removeListener(registrationHandle), removeListener(errorHandle)]);
    }
}
