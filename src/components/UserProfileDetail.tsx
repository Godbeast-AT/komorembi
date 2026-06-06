"use client";

import { useState } from "react";
import { ChevronRight, Heart, Zap, Flag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PageTransition from "./PageTransition";

interface DiscoveryUser {
    peer_id: string;
    display_name: string;
    photos?: string[];
    interests?: string[];
    bio?: string;
}

interface UserProfileDetailProps {
    selectedUser: DiscoveryUser;
    setSelectedUser: (user: DiscoveryUser | null) => void;
    handleLike: (user: DiscoveryUser, actionType: "like" | "super_like") => Promise<void> | void;
    onPass?: (peerId: string) => Promise<void> | void;
    onReport?: (peerId: string) => void;
}

export default function UserProfileDetail({
    selectedUser,
    setSelectedUser,
    handleLike,
    onPass,
    onReport,
}: UserProfileDetailProps) {
    const [isLiking, setIsLiking] = useState(false);
    const [likeType, setLikeType] = useState<"standard" | "super">("standard");
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

    const safePhotos = selectedUser.photos && selectedUser.photos.length > 0
        ? selectedUser.photos
        : [`https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUser.display_name)}&background=random&size=800`];

    const handleLikeWithAnimation = (type: "standard" | "super") => {
        setLikeType(type);
        setIsLiking(true);
        const actionType = type === "super" ? "super_like" : "like";

        // Wait for animation, then process like and reset state
        setTimeout(async () => {
            try {
                await handleLike(selectedUser, actionType);
            } finally {
                setIsLiking(false);
            }
        }, 700);
    };

    return (
        <PageTransition currentKey={`user-${selectedUser.peer_id}`}>
            <div className="bg-background text-foreground -mx-6 -mt-12 min-h-screen pb-28 overflow-y-auto relative">
                {/* Refined like burst animation overlay */}
                <AnimatePresence>
                    {isLiking && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none overflow-hidden">
                            <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{
                                    scale: 1,
                                    opacity: 1,
                                }}
                                exit={{ scale: 1.5, opacity: 0 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 400,
                                    damping: 20
                                }}
                                className="relative flex items-center justify-center"
                            >
                                {likeType === "standard" ? (
                                    <Heart className="w-40 h-40 text-rose-500 fill-rose-500 drop-shadow-[0_0_40px_rgba(244,63,94,0.5)]" />
                                ) : (
                                    <Zap className="w-40 h-40 text-indigo-500 fill-indigo-500 drop-shadow-[0_0_40px_rgba(99,102,241,0.5)]" />
                                )}

                                {/* Organic burst mini-icons */}
                                {[...Array(12)].map((_, i) => {
                                    const angle = (i * 30) + (Math.random() * 20 - 10);
                                    const distance = 160 + (Math.random() * 80);
                                    const duration = 0.6 + (Math.random() * 0.4);

                                    return (
                                        <motion.div
                                            key={i}
                                            initial={{ x: 0, y: 0, opacity: 1, scale: 0, rotate: 0 }}
                                            animate={{
                                                x: Math.cos(angle * Math.PI / 180) * distance,
                                                y: Math.sin(angle * Math.PI / 180) * distance,
                                                opacity: 0,
                                                scale: [0, 1.4, 0.4],
                                                rotate: angle + (Math.random() * 180 - 90)
                                            }}
                                            transition={{
                                                duration: duration,
                                                ease: [0.23, 1, 0.32, 1], // Custom cubic-bezier for snappy burst
                                            }}
                                            className="absolute"
                                        >
                                            {likeType === "standard" ? (
                                                <Heart className="w-10 h-10 text-rose-400 fill-rose-400" />
                                            ) : (
                                                <Zap className="w-10 h-10 text-indigo-400 fill-indigo-400" />
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                <div className="relative w-full aspect-[3/4] overflow-hidden">
                    <AnimatePresence initial={false} mode="wait">
                        <motion.img
                            key={currentPhotoIndex}
                            initial={{ opacity: 0, scale: 1.05 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            src={safePhotos[currentPhotoIndex]}
                            alt={selectedUser.display_name}
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                    </AnimatePresence>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />

                    {/* Slide indicators */}
                    {safePhotos.length > 1 && (
                        <div className="absolute top-3 left-3 right-3 z-40 flex gap-1.5 pointer-events-none">
                            {safePhotos.map((_, idx) => (
                                <div key={idx} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden shadow-sm backdrop-blur-sm">
                                    <div
                                        className={`h-full bg-white transition-all duration-300 ${idx === currentPhotoIndex ? 'w-full' : idx < currentPhotoIndex ? 'w-full' : 'w-0'}`}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Tap zones for sliding */}
                    {safePhotos.length > 1 && (
                        <div className="absolute inset-x-0 inset-y-12 z-20 flex">
                            <div
                                className="flex-1 cursor-w-resize"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentPhotoIndex(prev => Math.max(0, prev - 1));
                                }}
                            />
                            <div
                                className="flex-[1.5] cursor-e-resize"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentPhotoIndex(prev => Math.min(safePhotos.length - 1, prev + 1));
                                }}
                            />
                        </div>
                    )}

                    <button
                        onClick={() => setSelectedUser(null)}
                        className="absolute top-6 left-4 z-30 w-11 h-11 rounded-xl bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center"
                    >
                        <ChevronRight className="w-5 h-5 text-white rotate-180" />
                    </button>
                    <div className="absolute top-6 right-4 z-30 flex flex-col gap-2 items-end">
                        {onReport && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onReport(selectedUser.peer_id);
                                }}
                                className="w-11 h-11 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/40 hover:text-red-400 transition-colors"
                                title="Report User"
                            >
                                <Flag className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    <div className="absolute bottom-6 left-6 right-6 z-20">
                        <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-lg">{selectedUser.display_name}</h1>
                    </div>
                </div>

                <motion.div
                    className="px-6 pt-6 space-y-6"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                >
                    {selectedUser.interests && selectedUser.interests.length > 0 && (
                        <motion.div
                            className="space-y-3"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, ease: "easeOut", delay: 0.05 }}
                        >
                            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Interests</h3>
                            <div className="flex flex-wrap gap-2">
                                {selectedUser.interests.map((interest, i) => (
                                    <motion.span
                                        key={i}
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-2xl border border-border/60 bg-gradient-to-r from-muted/80 via-muted/40 to-background/40 text-sm font-semibold backdrop-blur-sm"
                                        initial={{ opacity: 0, y: 6, scale: 0.96 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ duration: 0.2, delay: 0.07 + i * 0.03, ease: "easeOut" }}
                                    >
                                        {interest}
                                    </motion.span>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    <motion.div
                        className="space-y-3"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut", delay: 0.08 }}
                    >
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">About</h3>
                        <div className="relative">
                            <div className="absolute -inset-px rounded-3xl bg-gradient-to-r from-rose-500/15 via-purple-500/10 to-sky-500/10 blur-lg opacity-60 pointer-events-none" />
                            <div className="relative bg-card/90 border border-border rounded-3xl p-4 backdrop-blur-md">
                                <p className="text-sm text-muted-foreground italic leading-relaxed">
                                    {selectedUser.bio || "Sometimes the best conversations start with a simple hello. ✨"}
                                </p>
                            </div>
                        </div>
                    </motion.div>

                    <div className="flex gap-3 pt-2 items-stretch h-24">
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                                if (onPass) {
                                    void onPass(selectedUser.peer_id);
                                    return;
                                }
                                setSelectedUser(null);
                            }}
                            className="flex-1 rounded-[28px] font-black text-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-all border border-border flex items-center justify-center flex-col shadow-sm"
                        >
                            <span className="mt-1">Pass</span>
                        </motion.button>

                        {/* Standard Like */}
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.92 }}
                            onClick={() => handleLikeWithAnimation("standard")}
                            disabled={isLiking}
                            className="flex-1 py-5 bg-white text-black rounded-[28px] font-black flex flex-col items-center justify-center gap-1 shadow-2xl transition-all hover:bg-rose-50 group border-b-4 border-black/10"
                        >
                            <Heart className="w-8 h-8 text-rose-500 fill-rose-500 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Like</span>
                        </motion.button>

                        {/* Super Like */}
                        <motion.button
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.92 }}
                            onClick={() => handleLikeWithAnimation("super")}
                            disabled={isLiking}
                            className="flex-1 py-5 bg-indigo-600 text-white rounded-[28px] font-black flex flex-col items-center justify-center gap-1 shadow-2xl transition-all hover:bg-indigo-700 group border-b-4 border-black/20"
                        >
                            <Zap className="w-8 h-8 text-indigo-300 fill-indigo-300 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">Super Like</span>
                        </motion.button>
                    </div>
                </motion.div>
            </div>
        </PageTransition>
    );
}
