"use client";

import { useState } from "react";
import { ChevronRight, Lock, Share2 } from "lucide-react";
import { nativeShare } from "../lib/share";
import type { WaitlistPreviewCard } from "@/services/supabase";

interface WaitlistViewProps {
    onBack: () => void;
    onLeaveWaitlist: () => Promise<void> | void;
    previewCards: WaitlistPreviewCard[];
    queuePosition?: number | null;
    referralUrl?: string;
}

export default function WaitlistView({
    onBack,
    onLeaveWaitlist,
    previewCards,
    queuePosition,
    referralUrl = "https://komorembi.app/invite",
}: WaitlistViewProps) {
    const [isSharing, setIsSharing] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);

    const handleInvite = async () => {
        setIsSharing(true);
        try {
            const success = await nativeShare({
                title: "Join Komorembi",
                text: "Meet me on Komorembi.",
                url: referralUrl,
                dialogTitle: "Share referral link",
            });

            if (!success) {
                await navigator.clipboard.writeText(referralUrl);
            }
        } finally {
            setIsSharing(false);
        }
    };

    const handleLeave = async () => {
        setIsLeaving(true);
        try {
            await onLeaveWaitlist();
        } finally {
            setIsLeaving(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-md space-y-6 rounded-[28px] border border-border bg-card p-6 text-foreground shadow-xl">
            <div className="space-y-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-background">
                    <Lock className="h-7 w-7 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-3xl font-black tracking-tight">High Demand</h2>
                    <p className="mx-auto max-w-[300px] text-sm font-medium leading-relaxed text-muted-foreground">
                        Your profile is ready. We will open access as the city balance improves.
                    </p>
                </div>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4 text-center">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Position in Queue</span>
                <p className="mt-1 font-mono text-3xl font-black tracking-tight">
                    {queuePosition ? queuePosition.toLocaleString() : "Pending"}
                </p>
            </div>

            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    {previewCards.slice(0, 4).map((card, index) => (
                        <div key={`${card.city}-${card.age_bucket}-${index}`} className="min-h-28 rounded-2xl border border-border bg-muted/40 p-3">
                            <div className="mb-3 h-10 rounded-xl bg-foreground/10 blur-[2px]" />
                            <div className="space-y-1 blur-[1px]">
                                <p className="text-sm font-black">{card.label}</p>
                                <p className="text-xs font-semibold text-muted-foreground">{card.age_bucket} in {card.city}</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{card.intention.replace("_", " ")}</p>
                            </div>
                        </div>
                    ))}
                    {previewCards.length === 0 && (
                        <div className="col-span-2 min-h-28 rounded-2xl border border-dashed border-border bg-muted/30 p-4" />
                    )}
                </div>
            </div>

            <div className="space-y-3">
                <button
                    type="button"
                    onClick={handleInvite}
                    disabled={isSharing}
                    className="flex w-full items-center justify-between rounded-2xl bg-foreground px-5 py-4 font-black text-background disabled:opacity-60"
                >
                    <span className="flex items-center gap-3">
                        <Share2 className="h-5 w-5" />
                        {isSharing ? "Sharing" : "Share referral link"}
                    </span>
                    <ChevronRight className="h-5 w-5" />
                </button>

                <button
                    type="button"
                    onClick={handleLeave}
                    disabled={isLeaving}
                    className="w-full rounded-2xl border border-border px-5 py-4 text-sm font-black text-muted-foreground disabled:opacity-60"
                >
                    {isLeaving ? "Leaving waitlist" : "Leave waitlist"}
                </button>

                <button
                    type="button"
                    onClick={onBack}
                    className="w-full py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"
                >
                    Back to profile
                </button>
            </div>
        </div>
    );
}
