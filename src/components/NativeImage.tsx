"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface NativeImageProps {
    src: string | undefined | null;
    alt: string;
    className?: string;
    fallbackInitials?: string;
}

export default function NativeImage({
    src,
    alt,
    className = "",
    fallbackInitials = "?"
}: NativeImageProps) {
    const [displaySrc, setDisplaySrc] = useState<string | null>(null);
    const [errorSrc, setErrorSrc] = useState<string | null>(null);

    useEffect(() => {
        if (!src) {
            return;
        }

        let isActive = true;

        const img = new Image();
        img.onload = () => {
            if (!isActive) return;
            setDisplaySrc(src);
            setErrorSrc(null);
        };
        img.onerror = () => {
            if (!isActive) return;
            setDisplaySrc(null);
            setErrorSrc(src);
        };
        img.src = src;

        return () => {
            isActive = false;
        };
    }, [src]);

    const isLoading = Boolean(src) && displaySrc !== src && errorSrc !== src;
    const error = !src || errorSrc === src;
    const initials = fallbackInitials !== "?"
        ? fallbackInitials
        : alt.split(" ").map((name) => name[0]).join("").slice(0, 2);

    return (
        <div className={`relative overflow-hidden ${className}`}>
            <AnimatePresence mode="wait">
                {isLoading && (
                    <motion.div
                        key="skeleton"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-muted/20 animate-pulse border border-white/5 flex items-center justify-center"
                    >
                        <div className="w-8 h-8 rounded-full border-2 border-primary/10 border-t-primary/30 animate-spin" />
                    </motion.div>
                )}

                {error ? (
                    <motion.div
                        key="fallback"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-gradient-to-br from-rose-100 to-indigo-100 flex items-center justify-center"
                    >
                        <span className="text-4xl font-black text-rose-500/40 uppercase tracking-tighter">
                            {initials}
                        </span>
                    </motion.div>
                ) : (
                    displaySrc === src && (
                        <motion.img
                            key="image"
                            src={displaySrc}
                            alt={alt}
                            initial={{ opacity: 0, scale: 1.05 }}
                            animate={{
                                opacity: isLoading ? 0 : 1,
                                scale: isLoading ? 1.05 : 1
                            }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                            className={`w-full h-full object-cover ${className}`}
                        />
                    )
                )}
            </AnimatePresence>
        </div>
    );
}
