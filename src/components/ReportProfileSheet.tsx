"use client";

import { useMemo, useState } from "react";
import { Flag, Loader2, X } from "lucide-react";
import {
    REPORT_DETAILS_MAX_LENGTH,
    REPORT_REASON_OPTIONS,
    isReportDetailsWithinLimit,
    isReportReason,
    normalizeReportDetails,
} from "@/lib/trustSafety.mjs";

type ReportProfileSheetProps = {
    isOpen: boolean;
    targetPeerId: string | null;
    isSubmitting?: boolean;
    onClose: () => void;
    onSubmit: (input: { reason: string; details: string | null; targetPeerId: string }) => Promise<void> | void;
};

export default function ReportProfileSheet({
    isOpen,
    targetPeerId,
    isSubmitting = false,
    onClose,
    onSubmit,
}: ReportProfileSheetProps) {
    const [reason, setReason] = useState("other");
    const [details, setDetails] = useState("");
    const detailsRemaining = REPORT_DETAILS_MAX_LENGTH - details.length;
    const canSubmit = useMemo(
        () => Boolean(targetPeerId && isReportReason(reason) && isReportDetailsWithinLimit(details)),
        [details, reason, targetPeerId],
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[240] flex items-end justify-center bg-black/55 backdrop-blur-sm px-3 pb-[env(safe-area-inset-bottom)]">
            <button
                type="button"
                aria-label="Close report form"
                className="absolute inset-0 cursor-default"
                onClick={onClose}
            />
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="report-profile-title"
                className="relative z-10 w-full max-w-lg rounded-t-3xl border border-white/10 bg-background p-5 shadow-2xl"
            >
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-500">
                            <Flag className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 id="report-profile-title" className="text-lg font-black tracking-tight">
                                Report profile
                            </h2>
                            <p className="text-xs font-semibold text-muted-foreground">
                                Reports are reviewed separately from blocks.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground hover:text-foreground disabled:opacity-60"
                        title="Close report form"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-3">
                    {REPORT_REASON_OPTIONS.map((option) => (
                        <label
                            key={option.value}
                            className={`flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 text-sm font-bold transition-colors ${reason === option.value
                                ? "border-rose-500 bg-rose-500/10 text-rose-600"
                                : "border-border bg-card text-foreground hover:border-rose-500/40"
                                }`}
                        >
                            <span>{option.label}</span>
                            <input
                                type="radio"
                                name="report_reason"
                                value={option.value}
                                checked={reason === option.value}
                                onChange={(event) => setReason(event.target.value)}
                                className="h-4 w-4 accent-rose-500"
                            />
                        </label>
                    ))}
                </div>

                <div className="mt-5 space-y-2">
                    <label htmlFor="report-details" className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                        Optional details
                    </label>
                    <textarea
                        id="report-details"
                        value={details}
                        onChange={(event) => setDetails(event.target.value)}
                        maxLength={REPORT_DETAILS_MAX_LENGTH}
                        rows={4}
                        className="w-full resize-none rounded-2xl border border-border bg-card p-4 text-sm font-medium outline-none transition-colors focus:border-rose-500"
                        placeholder="Add context for the moderation queue"
                    />
                    <p className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {detailsRemaining} left
                    </p>
                </div>

                <div className="mt-5 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="flex-1 rounded-2xl bg-muted px-4 py-3 text-xs font-black uppercase tracking-widest text-foreground hover:bg-muted/70 disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (!targetPeerId || !canSubmit) return;
                            void onSubmit({
                                targetPeerId,
                                reason,
                                details: normalizeReportDetails(details),
                            });
                        }}
                        disabled={!canSubmit || isSubmitting}
                        className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-rose-600 disabled:opacity-60"
                    >
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
                        Submit
                    </button>
                </div>
            </section>
        </div>
    );
}
