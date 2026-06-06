"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, ChevronRight, Clock, LogOut, MessageCircle, Send, Share2, ShieldAlert, Sparkles, Trash2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { nativeShare } from "../lib/share";
import {
    invalidateAllDeviceSessions,
    loadOwnAccountSafetyStatus,
    requestDataExport,
    requestSoftAccountDeletion,
    submitAccountAppeal,
    supabase,
    type AccountSafetyStatus,
} from "@/services/supabase";
import { APP_CONFIG } from "@/lib/constants";
import { normalizeNotificationPreferences } from "@/lib/profileSettings.mjs";
import {
    APPEAL_COMBINED_MAX_LENGTH,
    canSubmitAppeal,
    createPermanentBanMessage,
    createTemporaryBanMessage,
} from "@/lib/reportsSafety.mjs";
import BlockListPanel from "./BlockListPanel";
import ThemeToggle from "./ThemeToggle";

interface SettingsViewProps {
    currentPeerId: string;
}

const NOTIFICATION_PREFS_KEY = "komorembi_notification_preferences";
type NotificationPreferenceKey = "messages" | "streaks" | "waitlist" | "app_updates" | "quiet_hours_enabled";

function NotificationPreferencesPanel({ currentPeerId }: { currentPeerId: string }) {
    const [preferences, setPreferences] = useState(() => normalizeNotificationPreferences(undefined));

    useEffect(() => {
        let cancelled = false;

        const loadPreferences = async () => {
            let localPreferences;
            if (typeof window !== "undefined") {
                try {
                    const raw = window.localStorage.getItem(NOTIFICATION_PREFS_KEY);
                    localPreferences = raw ? JSON.parse(raw) : undefined;
                } catch {
                    localPreferences = undefined;
                }
            }

            if (!currentPeerId) {
                setPreferences(normalizeNotificationPreferences(localPreferences));
                return;
            }

            const { data } = await supabase
                .from("profiles")
                .select("notification_preferences")
                .eq("peer_id", currentPeerId)
                .single();

            if (!cancelled) {
                setPreferences(normalizeNotificationPreferences(data?.notification_preferences || localPreferences));
            }
        };

        void loadPreferences();

        return () => {
            cancelled = true;
        };
    }, [currentPeerId]);

    const updatePreference = (key: NotificationPreferenceKey, enabled: boolean) => {
        const next = normalizeNotificationPreferences({
            ...preferences,
            [key]: enabled,
        });

        setPreferences(next);

        if (typeof window !== "undefined") {
            window.localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(next));
        }

        if (currentPeerId) {
            void supabase
                .from("profiles")
                .update({ notification_preferences: next })
                .eq("peer_id", currentPeerId);
        }
    };

    const items: Array<{ key: NotificationPreferenceKey; label: string; description: string; icon: LucideIcon }> = [
        { key: "messages", label: "Messages", description: "New and pending conversations", icon: MessageCircle },
        { key: "streaks", label: "Streaks", description: "Milestones and meet prompts", icon: Sparkles },
        { key: "waitlist", label: "Waitlist", description: "Queue movement and admission", icon: Bell },
        { key: "app_updates", label: "App Updates", description: "Welcome and product notices", icon: Sparkles },
        { key: "quiet_hours_enabled", label: "Quiet Hours", description: "Pause optional alerts from 11pm to 8am IST", icon: Clock },
    ];

    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="flex gap-3 p-4 border-b border-border/50">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <Bell className="h-4 w-4" />
                </div>
                <div>
                    <p className="font-bold">Notification Preferences</p>
                    <p className="text-xs text-muted-foreground">Choose which app alerts stay enabled on this device.</p>
                </div>
            </div>
            <div className="divide-y divide-border/50">
                {items.map((item) => {
                    const Icon = item.icon;
                    const enabled = Boolean(preferences[item.key]);

                    return (
                        <label key={item.key} className="flex items-center justify-between gap-4 p-4">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                                    <Icon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-black">{item.label}</p>
                                    <p className="text-xs text-muted-foreground">{item.description}</p>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={enabled}
                                onChange={(event) => updatePreference(item.key, event.target.checked)}
                                className="h-5 w-5 accent-rose-500"
                            />
                        </label>
                    );
                })}
            </div>
        </div>
    );
}

function AccountLifecyclePanel({ currentPeerId }: { currentPeerId: string }) {
    const [isInvalidating, setIsInvalidating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleInvalidateSessions = async () => {
        setIsInvalidating(true);
        setError(null);
        setSuccess(null);
        try {
            await invalidateAllDeviceSessions();
        } catch (err: any) {
            setError(err.message || "Could not invalidate sessions.");
        } finally {
            setIsInvalidating(false);
        }
    };

    const handleRequestDataExport = async () => {
        setIsExporting(true);
        setError(null);
        setSuccess(null);
        try {
            await requestDataExport();
            setSuccess("Data export requested. It will be prepared within 48 hours.");
        } catch (err: any) {
            setError(err.message || "Could not request data export.");
        } finally {
            setIsExporting(false);
        }
    };

    const handleRequestDeletion = async () => {
        const confirmed = window.confirm(
            "Delete your account? Your profile will be hidden immediately and final deletion happens after 14 days.",
        );
        if (!confirmed) return;

        setIsDeleting(true);
        setError(null);
        setSuccess(null);
        try {
            await requestSoftAccountDeletion(currentPeerId || null);
        } catch (err: any) {
            setError(err.message || "Could not request account deletion.");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="flex gap-3 p-4 border-b border-border/50">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <LogOut className="h-4 w-4" />
                </div>
                <div>
                    <p className="font-bold">Account Access</p>
                    <p className="text-xs text-muted-foreground">Manage device sessions, exports, and deletion.</p>
                </div>
            </div>
            <div className="divide-y divide-border/50">
                <button
                    type="button"
                    onClick={handleInvalidateSessions}
                    disabled={isInvalidating || isDeleting || isExporting}
                    className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <div>
                        <p className="text-sm font-black">Log out of all devices</p>
                        <p className="text-xs text-muted-foreground">Every saved session must verify by phone again.</p>
                    </div>
                    <LogOut className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
                <button
                    type="button"
                    onClick={handleRequestDataExport}
                    disabled={isInvalidating || isDeleting || isExporting}
                    className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <div>
                        <p className="text-sm font-black">Request data export</p>
                        <p className="text-xs text-muted-foreground">Prepared within 48 hours.</p>
                    </div>
                    <Share2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
                <button
                    type="button"
                    onClick={handleRequestDeletion}
                    disabled={isInvalidating || isDeleting || isExporting}
                    className="flex w-full items-center justify-between gap-4 p-4 text-left text-rose-500 transition-colors hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <div>
                        <p className="text-sm font-black">Delete account</p>
                        <p className="text-xs text-muted-foreground">Hidden immediately, then purged after 14 days.</p>
                    </div>
                    <Trash2 className="h-4 w-4 shrink-0" />
                </button>
            </div>
            {success && <p className="px-4 pb-4 text-xs font-semibold text-emerald-600">{success}</p>}
            {error && <p className="px-4 pb-4 text-xs font-semibold text-red-500">{error}</p>}
        </div>
    );
}

function AccountAppealsPanel({ currentPeerId }: { currentPeerId: string }) {
    const [status, setStatus] = useState<AccountSafetyStatus | null>(null);
    const [whatHappened, setWhatHappened] = useState("");
    const [whyWrong, setWhyWrong] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const loadStatus = async () => {
            if (!currentPeerId) {
                setStatus(null);
                return;
            }

            setIsLoading(true);
            try {
                const nextStatus = await loadOwnAccountSafetyStatus();
                if (!cancelled) setStatus(nextStatus);
            } catch (err) {
                console.warn("Could not load account safety status", err);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        void loadStatus();

        return () => {
            cancelled = true;
        };
    }, [currentPeerId]);

    const isVisible = Boolean(status?.is_banned || status?.flagged_for_review);
    if (!isVisible && !isLoading) return null;

    const characterCount = whatHappened.length + whyWrong.length;
    const canSubmit = canSubmitAppeal({ whatHappened, whyWrong }) && !isSubmitting;
    const statusCopy = status?.ban_reason
        || (status?.ban_level === "report_30_permanent"
            ? createPermanentBanMessage()
            : status?.is_banned
                ? createTemporaryBanMessage(status.account_banned_until)
                : "Your account has been flagged. You can send context for the moderation team to review.");

    const updateAppealField = (field: "what" | "why", value: string) => {
        if (field === "what") {
            const allowedLength = Math.max(0, APPEAL_COMBINED_MAX_LENGTH - whyWrong.length);
            setWhatHappened(value.slice(0, allowedLength));
            return;
        }

        const allowedLength = Math.max(0, APPEAL_COMBINED_MAX_LENGTH - whatHappened.length);
        setWhyWrong(value.slice(0, allowedLength));
    };

    const submitAppeal = async () => {
        if (!canSubmit) return;

        setIsSubmitting(true);
        setMessage(null);
        try {
            await submitAccountAppeal({ whatHappened, whyWrong });
            setWhatHappened("");
            setWhyWrong("");
            setMessage("Appeal submitted for review.");
        } catch (err: any) {
            setMessage(err.message || "Could not submit your appeal.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="flex gap-3 p-4 border-b border-border/50">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
                    <ShieldAlert className="h-4 w-4" />
                </div>
                <div>
                    <p className="font-bold">Appeal Account Action</p>
                    <p className="text-xs text-muted-foreground">
                        {isLoading ? "Checking account status..." : statusCopy}
                    </p>
                </div>
            </div>
            <div className="space-y-4 p-4">
                <div className="space-y-2">
                    <label htmlFor="appeal-what-happened" className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                        What happened?
                    </label>
                    <textarea
                        id="appeal-what-happened"
                        rows={3}
                        value={whatHappened}
                        onChange={(event) => updateAppealField("what", event.target.value)}
                        className="w-full resize-none rounded-2xl border border-border bg-background p-3 text-sm font-medium outline-none focus:border-rose-500"
                    />
                </div>
                <div className="space-y-2">
                    <label htmlFor="appeal-why-wrong" className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                        Why do you think this decision was wrong?
                    </label>
                    <textarea
                        id="appeal-why-wrong"
                        rows={3}
                        value={whyWrong}
                        onChange={(event) => updateAppealField("why", event.target.value)}
                        className="w-full resize-none rounded-2xl border border-border bg-background p-3 text-sm font-medium outline-none focus:border-rose-500"
                    />
                </div>
                <div className="flex items-center justify-between gap-3">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${characterCount > APPEAL_COMBINED_MAX_LENGTH ? "text-rose-500" : "text-muted-foreground"}`}>
                        {characterCount}/{APPEAL_COMBINED_MAX_LENGTH}
                    </p>
                    <button
                        type="button"
                        onClick={() => void submitAppeal()}
                        disabled={!canSubmit}
                        className="flex items-center gap-2 rounded-2xl bg-rose-500 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-rose-600 disabled:opacity-60"
                    >
                        <Send className="h-4 w-4" />
                        {isSubmitting ? "Sending" : "Submit Appeal"}
                    </button>
                </div>
                {message && <p className="text-xs font-bold text-muted-foreground">{message}</p>}
            </div>
        </div>
    );
}

export default function SettingsView({
    currentPeerId,
}: SettingsViewProps) {
    const [showTerms, setShowTerms] = useState(false);
    const [showPrivacy, setShowPrivacy] = useState(false);

    return (
        <div className="bg-background text-foreground min-h-screen pb-20 overflow-hidden">
            <div className="px-4 pb-4 pt-1 flex justify-between items-center bg-background sticky top-0 z-50">
                <h2 className="text-4xl font-black tracking-tighter">Settings</h2>
            </div>

            <div className="p-6 space-y-8">
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Privacy & Security</h3>
                    <NotificationPreferencesPanel currentPeerId={currentPeerId} />
                    <BlockListPanel currentPeerId={currentPeerId} />
                    <AccountLifecyclePanel currentPeerId={currentPeerId} />
                    <AccountAppealsPanel currentPeerId={currentPeerId} />
                </div>

                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Appearance</h3>
                    <div className="bg-card border border-border rounded-2xl p-4 flex justify-between items-center shadow-sm">
                        <div>
                            <p className="font-bold">Theme Mode</p>
                            <p className="text-xs text-muted-foreground">Toggle dark or light mode</p>
                        </div>
                        <ThemeToggle />
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">About</h3>
                    <div className="bg-card border border-border rounded-2xl p-4 space-y-4 shadow-sm">
                        <div className="flex justify-between items-center">
                            <p className="font-bold text-sm">Version</p>
                            <p className="text-muted-foreground text-sm">{APP_CONFIG.VERSION} ({APP_CONFIG.NAME})</p>
                        </div>
                        <button
                            className="w-full flex justify-between items-center hover:bg-muted/50 p-2 -mx-2 rounded-xl transition-colors"
                            onClick={() => setShowTerms(true)}
                        >
                            <p className="font-bold text-sm text-foreground">Terms of Service</p>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button
                            className="w-full flex justify-between items-center hover:bg-muted/50 p-2 -mx-2 rounded-xl transition-colors"
                            onClick={() => setShowPrivacy(true)}
                        >
                            <p className="font-bold text-sm text-foreground">Privacy Policy</p>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <div className="pt-4 border-t border-border/50">
                            <button
                                onClick={() => nativeShare({
                                    title: "Download Komorembi",
                                    text: "Join me on Komorembi for intentional profiles and safer conversations.",
                                    url: "https://komorembi.app",
                                    dialogTitle: "Share Komorembi",
                                })}
                                className="w-full py-4 bg-foreground text-background rounded-2xl font-black flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                            >
                                <Share2 className="w-5 h-5" />
                                Share with Friends
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {showTerms && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="fixed inset-0 z-[100] bg-background p-6 overflow-y-auto pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
                    >
                        <div className="max-w-2xl mx-auto space-y-6">
                            <div className="flex items-center justify-between sticky top-0 bg-background py-4 border-b border-border z-10">
                                <h3 className="text-2xl font-black tracking-tight">Terms of Service</h3>
                                <button onClick={() => setShowTerms(false)} className="p-2 bg-muted rounded-full">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="prose prose-sm max-w-none text-muted-foreground pb-20">
                                <p className="font-bold text-foreground">Last updated: June 2026</p>
                                <h4 className="text-foreground">Eligibility</h4>
                                <p>You must be at least 18 years old to use Komorembi.</p>
                                <h4 className="text-foreground">Safety</h4>
                                <p>Reports, blocks, moderation decisions, and appeals are governed by the community safety rules in this MVP.</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showPrivacy && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="fixed inset-0 z-[100] bg-background p-6 overflow-y-auto pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
                    >
                        <div className="max-w-2xl mx-auto space-y-6">
                            <div className="flex items-center justify-between sticky top-0 bg-background py-4 border-b border-border z-10">
                                <h3 className="text-2xl font-black tracking-tight">Privacy Policy</h3>
                                <button onClick={() => setShowPrivacy(false)} className="p-2 bg-muted rounded-full">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="prose prose-sm max-w-none text-muted-foreground pb-20">
                                <p className="font-bold text-foreground">Last updated: June 2026</p>
                                <p>Komorembi stores app profile data, message history, reports, login timestamps, and device identifiers for notifications. It does not store GPS location, government ID, or payment data in the MVP.</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
