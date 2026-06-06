"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Flag, MessageSquareWarning, RefreshCw, Shield, Users } from "lucide-react";
import { supabase } from "@/services/supabase";

type AdminSectionKey =
    | "users"
    | "reports"
    | "blockedMessages"
    | "waitlists"
    | "signupStats"
    | "genderRatios"
    | "messageVolume"
    | "appeals"
    | "preBanContext";

type AdminRow = Record<string, unknown>;

const ADMIN_SECTION_CONFIG: Array<{
    key: AdminSectionKey;
    title: string;
    view: string;
    icon: typeof Users;
}> = [
        { key: "users", title: "Users", view: "admin_users", icon: Users },
        { key: "reports", title: "Reports", view: "admin_reports", icon: Flag },
        { key: "blockedMessages", title: "Blocked Messages", view: "admin_blocked_messages", icon: MessageSquareWarning },
        { key: "waitlists", title: "Waitlists", view: "admin_waitlists", icon: Shield },
        { key: "signupStats", title: "Signup Stats", view: "admin_signup_stats", icon: BarChart3 },
        { key: "genderRatios", title: "Gender Ratios", view: "admin_gender_ratios", icon: Users },
        { key: "messageVolume", title: "Message Volume", view: "admin_message_volume", icon: BarChart3 },
        { key: "appeals", title: "Appeals", view: "admin_appeals_queue", icon: Shield },
        { key: "preBanContext", title: "Pre-Ban Context", view: "admin_pre_ban_context_submissions", icon: MessageSquareWarning },
    ];

function formatCell(value: unknown) {
    if (value == null) return "N/A";
    if (Array.isArray(value)) return `${value.length} items`;
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

export default function AdminDashboardView() {
    const [rowsBySection, setRowsBySection] = useState<Record<AdminSectionKey, AdminRow[]>>({
        users: [],
        reports: [],
        blockedMessages: [],
        waitlists: [],
        signupStats: [],
        genderRatios: [],
        messageVolume: [],
        appeals: [],
        preBanContext: [],
    });
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const fetchAdminViews = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage(null);

        try {
            const entries = await Promise.all(
                ADMIN_SECTION_CONFIG.map(async (section) => {
                    const { data, error } = await supabase
                        .from(section.view)
                        .select("*")
                        .limit(8);

                    if (error) throw error;
                    return [section.key, data || []] as const;
                }),
            );

            setRowsBySection(Object.fromEntries(entries) as Record<AdminSectionKey, AdminRow[]>);
        } catch (err) {
            console.error("Admin dashboard load failed", err);
            setErrorMessage("Admin views are not available for this session.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchAdminViews();
    }, [fetchAdminViews]);

    return (
        <div className="min-h-screen bg-background px-4 pb-24 pt-6 text-foreground">
            <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 pb-6">
                <div>
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Founder Console</p>
                    <h1 className="text-3xl font-black tracking-tight">Safety Dashboard</h1>
                </div>
                <button
                    type="button"
                    onClick={() => void fetchAdminViews()}
                    disabled={isLoading}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground hover:text-foreground disabled:opacity-60"
                    title="Refresh admin dashboard"
                >
                    <RefreshCw className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
                </button>
            </header>

            {errorMessage && (
                <p className="mx-auto mb-4 max-w-6xl rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-600">
                    {errorMessage}
                </p>
            )}

            <div className="mx-auto grid w-full max-w-6xl gap-4 md:grid-cols-2 xl:grid-cols-3">
                {ADMIN_SECTION_CONFIG.map((section) => {
                    const Icon = section.icon;
                    const rows = rowsBySection[section.key];
                    const firstRow = rows[0] || {};
                    const previewKeys = Object.keys(firstRow).slice(0, 4);

                    return (
                        <section key={section.key} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="font-black">{section.title}</h2>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                            {rows.length} rows
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {rows.length === 0 ? (
                                <p className="rounded-xl bg-muted/50 p-4 text-sm font-semibold text-muted-foreground">
                                    No entries.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {rows.slice(0, 3).map((row, rowIndex) => (
                                        <div key={`${section.key}-${rowIndex}`} className="rounded-xl border border-border/70 bg-background/50 p-3">
                                            {previewKeys.map((key) => (
                                                <div key={key} className="flex justify-between gap-3 text-xs">
                                                    <span className="font-bold text-muted-foreground">{key}</span>
                                                    <span className="max-w-[11rem] truncate font-semibold text-foreground">
                                                        {formatCell(row[key])}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    );
                })}
            </div>
        </div>
    );
}
