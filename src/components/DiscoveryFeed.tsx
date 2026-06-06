"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Flag, RefreshCw, SlidersHorizontal } from "lucide-react";
import PageTransition from "./PageTransition";
import DiscoveryCard from "./DiscoveryCard";
import type { FeedFilters } from "@/services/supabase";

interface DiscoveryUser {
    peer_id: string;
    display_name: string;
    birth_date?: string | null;
    city?: string;
    photos?: string[];
    profile_prompt?: string;
    bio?: string;
    last_seen_at?: string | null;
    created_at?: string | null;
}

interface DiscoveryFeedProps {
    isDiscovering: boolean;
    isLoadingMore: boolean;
    hasMore: boolean;
    discoveryUsers: DiscoveryUser[];
    themeMode?: "calm" | "bold";
    feedFilters: FeedFilters;
    setFeedFilters: (filters: FeedFilters) => void;
    setSelectedUser: (user: DiscoveryUser) => void;
    onRefresh: () => void;
    onLoadMore: () => void;
    onReport?: (peerId: string) => void;
}

export default function DiscoveryFeed({
    isDiscovering,
    isLoadingMore,
    hasMore,
    discoveryUsers,
    themeMode = "calm",
    feedFilters,
    setFeedFilters,
    setSelectedUser,
    onRefresh,
    onLoadMore,
    onReport,
}: DiscoveryFeedProps) {
    const loadMoreRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const target = loadMoreRef.current;
        if (!target || !hasMore || isDiscovering || isLoadingMore) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting) onLoadMore();
            },
            { rootMargin: "240px" },
        );

        observer.observe(target);
        return () => observer.disconnect();
    }, [hasMore, isDiscovering, isLoadingMore, onLoadMore]);

    const updateFilter = (patch: Partial<FeedFilters>) => {
        setFeedFilters({
            ...feedFilters,
            ...patch,
        });
    };

    return (
        <PageTransition currentKey="feed">
            <div className="space-y-6 pt-0">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-3xl font-black tracking-tight text-foreground">Discover</h2>
                    <button
                        onClick={onRefresh}
                        disabled={isDiscovering}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-all disabled:opacity-50"
                        title="Refresh feed"
                    >
                        <RefreshCw className={`h-4 w-4 ${isDiscovering ? "animate-spin" : ""}`} />
                    </button>
                </div>

                <div className="mx-2 grid grid-cols-[auto_1fr_1fr] items-end gap-2 rounded-lg border border-border bg-card p-3 sm:grid-cols-[auto_1fr_1fr_1.5fr]">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <SlidersHorizontal className="h-4 w-4" />
                    </div>
                    <label className="space-y-1">
                        <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Min Age</span>
                        <input
                            type="number"
                            min={18}
                            max={100}
                            value={feedFilters.minAge}
                            onChange={(event) => updateFilter({ minAge: Number(event.target.value) })}
                            className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm font-bold"
                        />
                    </label>
                    <label className="space-y-1">
                        <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Max Age</span>
                        <input
                            type="number"
                            min={18}
                            max={100}
                            value={feedFilters.maxAge}
                            onChange={(event) => updateFilter({ maxAge: Number(event.target.value) })}
                            className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm font-bold"
                        />
                    </label>
                    <label className="col-span-3 space-y-1 sm:col-span-1">
                        <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">City</span>
                        <input
                            type="text"
                            value={feedFilters.city}
                            onChange={(event) => updateFilter({ city: event.target.value })}
                            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-bold"
                        />
                    </label>
                </div>

                <motion.div
                    initial="hidden"
                    animate="show"
                    variants={{
                        hidden: { opacity: 0 },
                        show: {
                            opacity: 1,
                            transition: { staggerChildren: 0.06 },
                        },
                    }}
                    className="grid grid-cols-2 gap-3 px-2 pb-24"
                >
                    {isDiscovering ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <motion.div
                                key={i}
                                variants={{
                                    hidden: { opacity: 0, y: 20 },
                                    show: { opacity: 1, y: 0 },
                                }}
                                className="col-span-2 h-36 animate-pulse rounded-lg border border-border bg-muted/30 sm:col-span-1"
                            />
                        ))
                    ) : discoveryUsers.length > 0 ? (
                        discoveryUsers.map((user, index) => (
                            <DiscoveryCard
                                key={user.peer_id}
                                user={user}
                                onClick={() => setSelectedUser(user)}
                                onReport={() => onReport?.(user.peer_id)}
                                isLarge={index === 0}
                                themeMode={themeMode}
                            />
                        ))
                    ) : (
                        <div className="col-span-2 flex min-h-40 flex-col items-center justify-center rounded-lg border border-border bg-muted/10 p-8 text-center text-muted-foreground">
                            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                                <Flag className="h-5 w-5 text-muted-foreground/40" />
                            </div>
                            <h3 className="mb-1 text-lg font-black text-foreground">None Nearby</h3>
                            <p className="text-xs font-medium">Try a broader filter.</p>
                        </div>
                    )}
                    <div ref={loadMoreRef} className="col-span-2 h-2" />
                    {isLoadingMore && (
                        <div className="col-span-2 h-20 animate-pulse rounded-lg border border-border bg-muted/30" />
                    )}
                </motion.div>
            </div>
        </PageTransition>
    );
}
