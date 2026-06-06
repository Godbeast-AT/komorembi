"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Flag, MapPin, Sparkles } from "lucide-react";
import NativeImage from "./NativeImage";
import { calculateAge } from "@/lib/onboardingProfile.mjs";

interface DiscoveryUser {
    peer_id: string;
    display_name: string;
    birth_date?: string | null;
    photos?: string[];
    city?: string;
    profile_prompt?: string;
    bio?: string;
    last_seen_at?: string | null;
    created_at?: string | null;
}

interface DiscoveryCardProps {
    user: DiscoveryUser;
    onClick?: () => void;
    onReport?: () => void;
    isLarge?: boolean;
    isPreview?: boolean;
    themeMode?: "calm" | "bold";
}

export default function DiscoveryCard({ user, onClick, onReport, isLarge = false, isPreview = false, themeMode = "calm" }: DiscoveryCardProps) {
    const isBold = themeMode === "bold";
    const cardLayout = isBold ? "photo_first" : "text_first";
    const slot1Photo = Array.isArray(user.photos) && user.photos.length > 0
        ? user.photos[0]
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.display_name)}&background=random&size=400`;

    const age = useMemo(() => {
        if (user.birth_date) return calculateAge(user.birth_date);
        return null;
    }, [user.birth_date]);

    const prompt = user.profile_prompt || user.bio || "Ask me about the small thing that made my week.";

    if (isBold) {
        return (
            <motion.div
                role={isPreview ? undefined : "button"}
                tabIndex={isPreview ? undefined : 0}
                data-theme-mode={themeMode}
                data-card-layout={cardLayout}
                data-parallax-target-fps={isBold ? 60 : undefined}
                variants={{
                    hidden: { opacity: 0, y: 14 },
                    show: { opacity: 1, y: 0 },
                }}
                whileTap={isPreview ? undefined : { scale: 0.98 }}
                onClick={isPreview ? undefined : onClick}
                onKeyDown={(event) => {
                    if (isPreview) return;
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onClick?.();
                    }
                }}
                className={`group relative col-span-2 min-h-72 overflow-hidden rounded-lg border border-white/10 bg-card text-left shadow-[0_18px_50px_rgba(0,0,0,0.32)] transition-transform duration-150 ${isLarge ? "sm:col-span-2" : "sm:col-span-1"} ${isPreview ? "cursor-default" : "cursor-pointer"}`}
                aria-label={isPreview ? "Profile preview card" : `Open ${user.display_name}`}
                style={{ transform: "translateZ(0)" }}
            >
                <NativeImage
                    src={slot1Photo}
                    alt={`Slot 1 profile photo for ${user.display_name}`}
                    className="absolute inset-0 h-full w-full scale-[1.02] object-cover transition-transform duration-150 group-hover:scale-[1.05]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/5" />
                {onReport && !isPreview && (
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onReport();
                        }}
                        className="absolute right-3 top-3 z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white/80 backdrop-blur-xl transition-colors hover:text-red-300"
                        aria-label={`Report ${user.display_name}`}
                    >
                        <Flag className="h-4 w-4" />
                    </button>
                )}
                <div className="absolute inset-x-0 bottom-0 z-10 space-y-3 p-4 text-white">
                    <div>
                        <h3 className="truncate text-2xl font-black tracking-normal">
                            {user.display_name}
                            {age ? <span className="ml-2 text-base font-bold text-white/75">{age}</span> : null}
                        </h3>
                        {user.city && (
                            <p className="mt-1 flex items-center gap-1 text-xs font-bold text-white/70">
                                <MapPin className="h-3 w-3" />
                                {user.city}
                            </p>
                        )}
                    </div>
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-white/90">{prompt}</p>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/60">
                        <Sparkles className="h-3 w-3 text-rose-200" />
                        Bold mode
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            role={isPreview ? undefined : "button"}
            tabIndex={isPreview ? undefined : 0}
            data-theme-mode={themeMode}
            data-card-layout={cardLayout}
            data-parallax-target-fps={isBold ? 60 : undefined}
            variants={{
                hidden: { opacity: 0, y: 10 },
                show: { opacity: 1, y: 0 },
            }}
            whileTap={isPreview ? undefined : { scale: 0.98 }}
            onClick={isPreview ? undefined : onClick}
            onKeyDown={(event) => {
                if (isPreview) return;
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onClick?.();
                }
            }}
            className={`col-span-2 flex min-h-36 w-full gap-4 rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/30 ${isLarge ? "sm:col-span-2" : "sm:col-span-1"} ${isPreview ? "cursor-default" : "cursor-pointer"}`}
            aria-label={isPreview ? "Profile preview card" : `Open ${user.display_name}`}
        >
            <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="truncate text-lg font-black tracking-tight text-foreground">
                            {user.display_name}
                            {age ? <span className="ml-1 text-sm font-bold text-muted-foreground">{age}</span> : null}
                        </h3>
                        {user.city && (
                            <p className="mt-1 flex items-center gap-1 text-xs font-bold text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {user.city}
                            </p>
                        )}
                    </div>
                    {onReport && !isPreview && (
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                onReport();
                            }}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-red-500"
                            aria-label={`Report ${user.display_name}`}
                        >
                            <Flag className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <p className="line-clamp-3 text-sm font-medium leading-relaxed text-foreground">{prompt}</p>

                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <Sparkles className="h-3 w-3 text-muted-foreground/40" />
                    Active this month
                </div>
            </div>

            <div className="w-24 shrink-0 space-y-2">
                <NativeImage
                    src={slot1Photo}
                    alt={`Slot 1 profile photo for ${user.display_name}`}
                    className="aspect-[4/5] w-full rounded-lg object-cover"
                />
                <p className="text-center text-[9px] font-black uppercase tracking-widest text-muted-foreground">Slot 1</p>
            </div>
        </motion.div>
    );
}
