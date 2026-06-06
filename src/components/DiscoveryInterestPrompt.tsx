"use client";

import { useState } from "react";
import { CheckCircle2, Sparkles, X } from "lucide-react";
import { motion } from "framer-motion";

type DiscoveryInterestPromptProps = {
    initialInterests: string[];
    onSave: (interests: string[]) => Promise<void> | void;
    onSkip: () => void;
};

const INTEREST_CATEGORIES = [
    {
        title: "Interests",
        items: ["Science & Tech", "Finance", "Fashion", "Books", "Gaming", "Sports", "History", "World", "Music"],
    },
    {
        title: "Movies & TV",
        items: ["Indian Ent.", "K-Drama", "English TV", "Anime"],
    },
    {
        title: "Personal",
        items: ["Dating", "Corporate", "Student", "Mental Health", "Faith", "Everyday", "Lifestyle"],
    },
];

export default function DiscoveryInterestPrompt({
    initialInterests,
    onSave,
    onSkip,
}: DiscoveryInterestPromptProps) {
    const [selected, setSelected] = useState<string[]>(initialInterests);
    const [isSaving, setIsSaving] = useState(false);

    const toggleInterest = (interest: string) => {
        setSelected((current) => {
            if (current.includes(interest)) {
                return current.filter((item) => item !== interest);
            }
            if (current.length >= 5) return current;
            return [...current, interest];
        });
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm sm:items-center">
            <motion.div
                initial={{ opacity: 0, y: 28, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="w-full max-w-md rounded-[32px] border border-border bg-background p-6 shadow-2xl"
            >
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/10 px-3 py-1 text-rose-500">
                            <Sparkles className="h-3.5 w-3.5" />
                            <span className="text-[9px] font-black uppercase tracking-widest">First Discovery</span>
                        </div>
                        <h2 className="text-2xl font-black tracking-tight">Tune your feed</h2>
                        <p className="text-sm font-medium text-muted-foreground">Choose up to five interests now, or skip and add them later from your profile.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onSkip}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground"
                        title="Skip interests"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="max-h-[46vh] space-y-5 overflow-y-auto pr-1">
                    {INTEREST_CATEGORIES.map((category) => (
                        <section key={category.title} className="space-y-2 text-left">
                            <h3 className="px-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">{category.title}</h3>
                            <div className="flex flex-wrap gap-2">
                                {category.items.map((interest) => {
                                    const isSelected = selected.includes(interest);
                                    return (
                                        <button
                                            type="button"
                                            key={interest}
                                            onClick={() => toggleInterest(interest)}
                                            className={`relative rounded-xl border px-3 py-2 text-xs font-black transition-all ${isSelected
                                                ? "border-[#cdec7d] bg-[#e5f8a0] text-black shadow-md"
                                                : "border-border bg-card text-foreground hover:bg-muted"
                                                }`}
                                        >
                                            {interest}
                                            {isSelected && (
                                                <CheckCircle2 className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full bg-[#e5f8a0] text-[#729215]" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </div>

                <div className="mt-6 flex gap-3">
                    <button
                        type="button"
                        onClick={onSkip}
                        className="flex-1 rounded-full bg-muted px-5 py-3 text-sm font-black text-muted-foreground"
                    >
                        Skip
                    </button>
                    <button
                        type="button"
                        disabled={isSaving}
                        onClick={async () => {
                            setIsSaving(true);
                            await onSave(selected);
                            setIsSaving(false);
                        }}
                        className="flex-[2] rounded-full bg-foreground px-5 py-3 text-sm font-black text-background disabled:opacity-60"
                    >
                        Save Interests
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
