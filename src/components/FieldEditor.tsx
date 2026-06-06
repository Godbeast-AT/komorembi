"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Check, CheckCircle2, ChevronLeft, Save } from "lucide-react";
import { useState, useMemo } from "react";
import PageTransition from "./PageTransition";
import {
    changeSensitiveProfileField,
    changeUsername,
    requestCityChange,
    updateProfilePublicFields,
} from "@/services/supabase";
import { normalizeSensitiveFieldValue } from "@/lib/profileEditing.mjs";

interface FieldEditorProps {
    editingField: string;
    setEditingField: (field: string | null) => void;
    pronouns: string;
    setPronouns: (p: string) => void;
    interests: string[];
    setInterests: (interests: string[] | ((prev: string[]) => string[])) => void;
    gender: string;
    setGender: (g: string) => void;
    sexuality: string;
    setSexuality: (s: string) => void;
    interestedIn: string;
    setInterestedIn: (i: string) => void;
    work: string;
    setWork: (w: string) => void;
    username: string;
    setUsername: (u: string) => void;
    intention: string;
    setIntention: (i: string) => void;
    genderPreference: string;
    setGenderPreference: (p: string) => void;
    city: string;
    setCity: (c: string) => void;
    state: string;
    setState: (s: string) => void;
    displayName: string;
    setDisplayName: (n: string) => void;
    birthDate: string;
    setBirthDate: (d: string) => void;
    fieldVisibility: Record<string, boolean>;
    setFieldVisibility: (v: any) => void;
    bio: string;
    setBio: (b: string) => void;
}

const FIELD_ORDER = [
    "Name",
    "Username",
    "Date of Birth",
    "Gender",
    "Gender Preference",
    "Intention",
    "City",
    "Pronouns",
    "Sexuality",
    "I'm interested in",
    "Work",
    "About",
    "Interests"
];

export default function FieldEditor(props: FieldEditorProps) {
    const {
        editingField, setEditingField,
        pronouns, setPronouns,
        interests, setInterests,
        gender, setGender,
        sexuality, setSexuality,
        interestedIn, setInterestedIn,
        work, setWork,
        username, setUsername,
        intention, setIntention,
        genderPreference, setGenderPreference,
        city, setCity,
        state, setState,
        displayName, setDisplayName,
        birthDate, setBirthDate,
        fieldVisibility, setFieldVisibility,
        bio, setBio,
    } = props;

    const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
    const [isSaving, setIsSaving] = useState(false);

    // Calculate Completion
    const completionPercentage = useMemo(() => {
        let filled = 0;
        if (displayName.trim()) filled++;
        if (birthDate) filled++;
        if (gender && gender !== "Not specified") filled++;
        if (pronouns) filled++;
        if (sexuality) filled++;
        if (interestedIn) filled++;
        if (work.trim()) filled++;
        if (bio.trim()) filled++;
        if (interests.length > 0) filled++;
        return Math.round((filled / FIELD_ORDER.length) * 100);
    }, [displayName, birthDate, gender, pronouns, sexuality, interestedIn, work, bio, interests]);

    const currentIndex = FIELD_ORDER.indexOf(editingField);
    const hasNext = currentIndex < FIELD_ORDER.length - 1;
    const hasPrev = currentIndex > 0;

    const saveCurrentField = async () => {
        if (editingField === "About") {
            await updateProfilePublicFields({ bio });
            return;
        }

        if (editingField === "Username") {
            await changeUsername(username);
            return;
        }

        if (editingField === "City") {
            await requestCityChange(city, state);
            return;
        }

        if (editingField === "Gender") {
            const acknowledged = window.confirm("Changing your gender will close all current conversations. This cannot be undone.");
            if (!acknowledged) throw new Error("Sensitive profile change cancelled.");
            await changeSensitiveProfileField({
                field: "gender",
                value: normalizeSensitiveFieldValue("gender", gender),
                warningAcknowledged: true,
            });
            return;
        }

        if (editingField === "Gender Preference") {
            const acknowledged = window.confirm("Changing your preference will close all current conversations. This cannot be undone.");
            if (!acknowledged) throw new Error("Sensitive profile change cancelled.");
            await changeSensitiveProfileField({
                field: "gender_preference",
                value: normalizeSensitiveFieldValue("gender_preference", genderPreference),
                warningAcknowledged: true,
            });
            return;
        }

        if (editingField === "Intention") {
            const acknowledged = window.confirm("Changing your intention starts a fresh dating mode: profile photos and interests will carry forward, old conversations will close, old waitlist position will be lost, and old feed state will not be restored. This cannot be undone.");
            if (!acknowledged) throw new Error("Sensitive profile change cancelled.");
            await changeSensitiveProfileField({
                field: "intention",
                value: normalizeSensitiveFieldValue("intention", intention),
                warningAcknowledged: true,
            });
        }
    };

    const handleNext = async () => {
        setIsSaving(true);
        try {
            await saveCurrentField();
        } catch (err: any) {
            setIsSaving(false);
            window.alert(err.message || "Could not save this field.");
            return;
        }

        window.setTimeout(() => {
            setIsSaving(false);
            if (hasNext) {
                setDirection(1);
                setEditingField(FIELD_ORDER[currentIndex + 1]);
            } else {
                setEditingField(null); // Finish
            }
        }, 150); // Haptic simulated delay
    };

    const handlePrev = () => {
        if (hasPrev) {
            setDirection(-1);
            setEditingField(FIELD_ORDER[currentIndex - 1]);
        }
    };

    // Transition variants
    const variants = {
        enter: (dir: number) => ({
            x: dir > 0 ? 300 : -300,
            opacity: 0
        }),
        center: {
            z: 0,
            x: 0,
            opacity: 1
        },
        exit: (dir: number) => ({
            z: 0,
            x: dir < 0 ? 300 : -300,
            opacity: 0
        })
    };

    return (
        <PageTransition currentKey="multiStepEditor">
            <div className="bg-background text-foreground -mx-6 -mt-12 min-h-screen flex flex-col relative overflow-hidden">

                {/* Header & Progress */}
                <div className="px-6 py-6 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border z-50">
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={() => setEditingField(null)} className="text-muted-foreground hover:text-foreground font-bold text-sm transition-colors">
                            Close
                        </button>
                        <div className="text-xs font-black text-primary tracking-widest uppercase bg-primary/10 px-3 py-1 rounded-full">
                            PRO Editor
                        </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-muted rounded-full h-2 mb-2 overflow-hidden">
                        <motion.div
                            className="bg-primary h-2 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${completionPercentage}%` }}
                            transition={{ duration: 0.5, ease: "easeInOut" }}
                        />
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        <span>Profile Quality</span>
                        <span>{completionPercentage}%</span>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 relative">
                    <AnimatePresence initial={false} custom={direction} mode="wait">
                        <motion.div
                            key={editingField}
                            custom={direction}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{
                                x: { type: "spring", stiffness: 300, damping: 30 },
                                opacity: { duration: 0.2 }
                            }}
                            className="absolute inset-0 px-6 py-8 overflow-y-auto pb-40"
                        >
                            <h2 className="text-3xl font-black mb-8 tracking-tighter">{editingField}</h2>

                            {editingField === "Pronouns" && (
                                <div className="space-y-6">
                                    <div className="flex flex-wrap gap-2">
                                        {pronouns.split(',').filter(p => p.trim()).map((p, i) => (
                                            <span key={i} className="px-4 py-2 bg-muted rounded-full text-sm font-bold flex items-center gap-2">
                                                {p}
                                                <button onClick={() => setPronouns(pronouns.split(',').filter(x => x !== p).join(','))}><span className="text-xs">✕</span></button>
                                            </span>
                                        ))}
                                    </div>
                                    <p className="text-sm font-bold text-muted-foreground">Select up to 4</p>
                                    <div className="space-y-4 pt-4">
                                        {["she", "her", "he", "him", "his", "they", "them"].map((p, i) => (
                                            <div
                                                key={i}
                                                onClick={() => {
                                                    const current = pronouns.split(',').map(s => s.trim()).filter(s => s);
                                                    if (current.includes(p)) {
                                                        setPronouns(current.filter(c => c !== p).join(','));
                                                    } else if (current.length < 4) {
                                                        setPronouns([...current, p].join(','));
                                                    }
                                                }}
                                                className="flex justify-between items-center pb-2 border-b border-border/30 cursor-pointer group"
                                            >
                                                <span className="text-xl font-bold group-hover:translate-x-1 transition-transform">{p}</span>
                                                <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${pronouns.includes(p) ? 'bg-primary border-primary' : 'border-border'}`}>
                                                    {pronouns.includes(p) && <Check className="w-4 h-4 text-primary-foreground" />}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {editingField === "Interests" && (
                                <div className="space-y-8 pb-10">
                                    <p className="text-sm font-bold text-muted-foreground">Select up to 5</p>
                                    {[
                                        {
                                            title: "Basic",
                                            items: [
                                                { label: "Science & Technology", icon: "👨‍🔬" },
                                                { label: "Business & Finance", icon: "💰" },
                                                { label: "Fashion & Beauty", icon: "👠" },
                                                { label: "Gaming", icon: "🎮" },
                                                { label: "Sports", icon: "🏎️" },
                                                { label: "Music", icon: "🎸" }
                                            ]
                                        },
                                        {
                                            title: "Lifestyle",
                                            items: [
                                                { label: "Food & Cooking", icon: "🍱" },
                                                { label: "Travel", icon: "✈️" },
                                                { label: "Student Life", icon: "🎓" },
                                                { label: "Mental Health", icon: "🧠" }
                                            ]
                                        }
                                    ].map((category, catIdx) => (
                                        <div key={catIdx} className="space-y-4">
                                            <h3 className="text-base font-bold tracking-tight text-primary/60 uppercase">{category.title}</h3>
                                            <div className="flex flex-wrap gap-3">
                                                {category.items.map((item, i) => {
                                                    const isSelected = interests.includes(item.label);
                                                    return (
                                                        <button
                                                            key={i}
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    setInterests((prev: string[]) => prev.filter(x => x !== item.label));
                                                                } else if (interests.length < 5) {
                                                                    setInterests((prev: string[]) => [...prev, item.label]);
                                                                }
                                                            }}
                                                            className={`flex items-center gap-2 px-4 py-3 rounded-full border-2 text-sm font-bold transition-all ${isSelected
                                                                ? 'bg-primary border-primary text-primary-foreground scale-[1.02] shadow-xl'
                                                                : 'bg-transparent border-border hover:border-primary/50 text-foreground'
                                                                }`}
                                                        >
                                                            <span className="text-xl">{item.icon}</span>
                                                            <span>{item.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {editingField === "About" && (
                                <div className="space-y-4">
                                    <textarea
                                        autoFocus
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        className="w-full h-48 text-xl font-medium bg-muted/40 border-2 border-border/50 rounded-2xl p-6 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 resize-none transition-all"
                                        placeholder="Write something magical about yourself..."
                                    />
                                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest text-right">
                                        {bio.length}/500
                                    </p>
                                </div>
                            )}

                            {editingField !== "Pronouns" && editingField !== "Interests" && editingField !== "About" && (
                                <div className="space-y-6">
                                    {editingField === "Gender" ? (
                                        <div className="flex flex-col gap-3">
                                            {["Man", "Woman", "Non-binary"].map((g) => (
                                                <button
                                                    key={g}
                                                    onClick={() => setGender(g)}
                                                    className={`px-6 py-4 rounded-2xl border-2 font-bold text-lg text-left transition-all ${gender === g ? 'bg-primary border-primary text-primary-foreground shadow-lg scale-[1.01]' : 'bg-transparent border-border hover:border-primary/30'}`}
                                                >
                                                    {g}
                                                </button>
                                            ))}
                                        </div>
                                    ) : editingField === "Gender Preference" ? (
                                        <div className="flex flex-col gap-3">
                                            {["Men", "Women", "Everyone"].map((p) => (
                                                <button
                                                    key={p}
                                                    onClick={() => {
                                                        setGenderPreference(p);
                                                        setInterestedIn(p);
                                                    }}
                                                    className={`px-6 py-4 rounded-2xl border-2 font-bold text-lg text-left transition-all ${genderPreference === p ? 'bg-primary border-primary text-primary-foreground shadow-lg scale-[1.01]' : 'bg-transparent border-border hover:border-primary/30'}`}
                                                >
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    ) : editingField === "Intention" ? (
                                        <div className="flex flex-col gap-3">
                                            {[
                                                { label: "Long term", value: "long_term" },
                                                { label: "Short term", value: "short_term" },
                                            ].map((option) => (
                                                <button
                                                    key={option.value}
                                                    onClick={() => setIntention(option.value)}
                                                    className={`px-6 py-4 rounded-2xl border-2 font-bold text-lg text-left transition-all ${intention === option.value ? 'bg-primary border-primary text-primary-foreground shadow-lg scale-[1.01]' : 'bg-transparent border-border hover:border-primary/30'}`}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    ) : editingField === "City" ? (
                                        <div className="space-y-4">
                                            <input
                                                type="text"
                                                autoFocus
                                                value={city}
                                                onChange={(event) => setCity(event.target.value)}
                                                className="w-full text-4xl font-black border-b-4 border-primary/20 bg-transparent focus:outline-none focus:border-primary pb-4 transition-colors"
                                                placeholder="City"
                                            />
                                            <input
                                                type="text"
                                                value={state}
                                                onChange={(event) => setState(event.target.value)}
                                                className="w-full text-2xl font-black border-b-4 border-primary/20 bg-transparent focus:outline-none focus:border-primary pb-4 transition-colors"
                                                placeholder="State"
                                            />
                                        </div>
                                    ) : (
                                        <input
                                            type={editingField === "Date of Birth" ? "date" : "text"}
                                            autoFocus
                                            value={
                                                editingField === "Name" ? displayName :
                                                    editingField === "Username" ? username :
                                                    editingField === "Date of Birth" ? birthDate :
                                                        editingField === "Sexuality" ? sexuality :
                                                            editingField === "I'm interested in" ? interestedIn :
                                                                work
                                            }
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                if (editingField === "Name") setDisplayName(v);
                                                else if (editingField === "Username") setUsername(v);
                                                else if (editingField === "Date of Birth") setBirthDate(v);
                                                else if (editingField === "Sexuality") setSexuality(v);
                                                else if (editingField === "I'm interested in") setInterestedIn(v);
                                                else setWork(v);
                                            }}
                                            className="w-full text-4xl font-black border-b-4 border-primary/20 bg-transparent focus:outline-none focus:border-primary pb-4 transition-colors"
                                            placeholder={`Your ${editingField}`}
                                        />
                                    )}
                                </div>
                            )}

                            {/* Visibility Toggle */}
                            {editingField !== "Name" && editingField !== "Date of Birth" && (
                                <div className="mt-12 p-6 bg-muted/50 rounded-2xl border border-border">
                                    <label className="flex items-center gap-4 cursor-pointer">
                                        <div
                                            onClick={() => setFieldVisibility((prev: any) => ({ ...prev, [editingField!]: !prev[editingField!] }))}
                                            className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${fieldVisibility[editingField!] ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}
                                        >
                                            {fieldVisibility[editingField!] && <Check className="w-5 h-5 text-primary-foreground" />}
                                        </div>
                                        <div>
                                            <p className="text-base font-bold">Visible on profile</p>
                                            <p className="text-xs text-muted-foreground font-medium mt-1">Show this to potential matches</p>
                                        </div>
                                    </label>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer Navigation */}
                <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background to-transparent z-50">
                    <div className="flex gap-4 max-w-3xl mx-auto">
                        {hasPrev && (
                            <button
                                onClick={handlePrev}
                                className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-foreground hover:bg-muted/80 transition-colors active:scale-95"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                        )}
                        <motion.button
                            onClick={handleNext}
                            whileTap={{ scale: 0.95 }}
                            animate={isSaving ? { scale: 1.05 } : { scale: 1 }}
                            className="flex-1 h-14 rounded-full bg-primary text-primary-foreground font-black text-lg flex items-center justify-center shadow-2xl transition-colors hover:bg-primary/90"
                        >
                            {isSaving ? (
                                <div className="w-6 h-6 border-4 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                            ) : (
                                <div className="flex items-center gap-2">
                                    {hasNext ? 'Save & Next' : 'Save & Finish'}
                                    {hasNext ? <ChevronRight className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                                </div>
                            )}
                        </motion.button>
                    </div>
                </div>

            </div>
        </PageTransition>
    );
}
