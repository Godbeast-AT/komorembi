"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Loader2, RotateCcw, ShieldOff } from "lucide-react";
import { supabase, unblockUser } from "@/services/supabase";
import { BLOCK_LIST_TABLES, normalizeBlockedAccounts } from "@/lib/profileSettings.mjs";
import NativeImage from "./NativeImage";

type BlockedAccount = {
    id: string;
    sourceTable: string;
    blockerPeerId: string;
    blockedPeerId: string;
    displayName: string;
    photos: string[];
    createdAt?: string;
};

type BlockListPanelProps = {
    currentPeerId: string;
};

export default function BlockListPanel({ currentPeerId }: BlockListPanelProps) {
    const [blockedAccounts, setBlockedAccounts] = useState<BlockedAccount[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [unblockingId, setUnblockingId] = useState<string | null>(null);

    const fetchBlockedAccounts = useCallback(async () => {
        await Promise.resolve();

        if (!currentPeerId) {
            setBlockedAccounts([]);
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        const rows: any[] = [];
        const failedTables: string[] = [];

        for (const tableName of BLOCK_LIST_TABLES) {
            const { data, error } = await supabase
                .from(tableName)
                .select("blocker_peer_id, blocked_peer_id, created_at")
                .eq("blocker_peer_id", currentPeerId)
                .order("created_at", { ascending: false });

            if (error) {
                failedTables.push(tableName);
                continue;
            }

            rows.push(...(data || []).map((row) => ({
                ...row,
                source_table: tableName,
            })));
        }

        const blockedPeerIds = Array.from(new Set(rows.map((row) => row.blocked_peer_id).filter(Boolean)));
        let profileMap = new Map<string, any>();

        if (blockedPeerIds.length > 0) {
            const { data: profiles, error } = await supabase
                .from("profiles")
                .select("peer_id, display_name, photos")
                .in("peer_id", blockedPeerIds);

            if (!error && profiles) {
                profileMap = new Map(profiles.map((profile) => [profile.peer_id, profile]));
            }
        }

        const normalized = normalizeBlockedAccounts(
            rows.map((row) => ({
                ...row,
                blocked_profile: profileMap.get(row.blocked_peer_id),
            })),
            currentPeerId,
        ) as BlockedAccount[];

        const seen = new Set<string>();
        const dedupedAccounts: BlockedAccount[] = [];

        for (const account of normalized) {
            if (seen.has(account.blockedPeerId)) continue;
            seen.add(account.blockedPeerId);
            dedupedAccounts.push(account);
        }

        setBlockedAccounts(dedupedAccounts);

        if (rows.length === 0 && failedTables.length === BLOCK_LIST_TABLES.length) {
            setErrorMessage("Block list is not available yet.");
        }

        setIsLoading(false);
    }, [currentPeerId]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void fetchBlockedAccounts();
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [fetchBlockedAccounts]);

    const unblockAccount = async (account: BlockedAccount) => {
        setUnblockingId(account.id);
        setErrorMessage(null);

        let error: unknown = null;

        try {
            await unblockUser(account.blockedPeerId);
        } catch (err) {
            error = err;
        }

        setUnblockingId(null);

        if (error) {
            setErrorMessage("Could not unblock this profile. Try again.");
            return;
        }

        setBlockedAccounts((current) => current.filter((item) => item.id !== account.id));
    };

    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-start justify-between gap-3 p-4 border-b border-border/50">
                <div className="flex gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                        <Ban className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="font-bold">Blocked Profiles</p>
                        <p className="text-xs text-muted-foreground">Review profiles you have blocked and restore access.</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => void fetchBlockedAccounts()}
                    disabled={isLoading}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground disabled:opacity-60"
                    title="Refresh block list"
                >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                </button>
            </div>

            {errorMessage && (
                <p className="px-4 py-3 text-xs font-bold text-rose-500">{errorMessage}</p>
            )}

            {isLoading ? (
                <div className="p-6 text-center text-xs font-bold text-muted-foreground">Loading blocked profiles...</div>
            ) : blockedAccounts.length > 0 ? (
                <div className="divide-y divide-border/50">
                    {blockedAccounts.map((account) => (
                        <div key={account.id} className="flex items-center justify-between gap-3 p-4">
                            <div className="flex min-w-0 items-center gap-3">
                                <NativeImage
                                    src={account.photos?.[0]}
                                    alt={`${account.displayName} avatar`}
                                    className="h-12 w-12 rounded-2xl object-cover border border-border/50"
                                    fallbackInitials={account.displayName?.[0]}
                                />
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-black">{account.displayName}</p>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                        {account.createdAt
                                            ? new Date(account.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })
                                            : "Blocked"}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => void unblockAccount(account)}
                                disabled={unblockingId === account.id}
                                className="shrink-0 rounded-full bg-muted px-4 py-2 text-[10px] font-black uppercase tracking-widest text-foreground hover:bg-foreground hover:text-background disabled:opacity-60"
                            >
                                {unblockingId === account.id ? "Removing" : "Unblock"}
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <ShieldOff className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-bold text-muted-foreground">No blocked profiles.</p>
                </div>
            )}
        </div>
    );
}
