"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, Eye } from "lucide-react";
import DiscoveryCard from "./DiscoveryCard";
import PhotoGridEditor from "./PhotoGridEditor";
import { updateProfilePublicFields } from "@/services/supabase";

interface ProfileViewProps {
    displayName: string;
    birthDate: string;
    interests: string[];
    calculateAge: (dateString: string) => number;
    photos: (File | string)[];
    setPhotos: (photos: (File | string)[]) => void;
    setOnboardingStatus: (status: any) => void;
    setEditingField: (field: string) => void;
    gender: string;
    username: string;
    intention: string;
    genderPreference: string;
    city: string;
    currentPeerId: string;
    bio: string;
    setBio: (bio: string) => void;
}

export default function ProfileView({
    displayName,
    birthDate,
    interests,
    calculateAge,
    photos,
    setPhotos,
    setOnboardingStatus,
    setEditingField,
    gender,
    username,
    intention,
    genderPreference,
    city,
    currentPeerId,
    bio,
    setBio,
}: ProfileViewProps) {
    const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
    const [isProfileVisible, setIsProfileVisible] = useState(true);
    const [isSavingPublicFields, setIsSavingPublicFields] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const photoUrls = photos.length > 0
        ? photos.map(p => typeof p === 'string' ? p : URL.createObjectURL(p as File))
        : [`https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || "You")}&background=random&size=400`];

    const savePublicFields = async (nextVisible = isProfileVisible) => {
        setIsSavingPublicFields(true);
        setSaveMessage(null);
        try {
            await updateProfilePublicFields({
                bio,
                photos: photos.filter((photo): photo is string => typeof photo === "string"),
                isVisible: nextVisible,
            });
            setSaveMessage("Profile changes saved.");
        } catch (err: any) {
            setSaveMessage(err.message || "Could not save profile changes.");
        } finally {
            setIsSavingPublicFields(false);
        }
    };

    const toggleVisibility = async () => {
        const nextVisible = !isProfileVisible;
        setIsProfileVisible(nextVisible);
        await savePublicFields(nextVisible);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col min-h-screen pb-24"
        >
            {/* Minimal Header */}
            <div className="flex justify-between items-center pb-4 pt-1 px-4">
                <h1 className="text-4xl font-black tracking-tighter">Profile</h1>
            </div>

            {/* Subtle Toggle */}
            <div className="flex justify-center mb-6">
                <div className="flex bg-black/5 rounded-full p-1 border border-black/5 backdrop-blur-sm">
                    {[
                        { id: 'edit', label: 'Edit', icon: LayoutDashboard },
                        { id: 'preview', label: 'Preview', icon: Eye }
                    ].map((mode) => {
                        const Icon = mode.icon;
                        const isActive = viewMode === mode.id;
                        return (
                            <button
                                key={mode.id}
                                onClick={() => setViewMode(mode.id as any)}
                                className={`flex items-center gap-2 px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${isActive ? "bg-background shadow-md text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                <Icon className="w-3 h-3" /> {mode.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <AnimatePresence mode="wait">
                {viewMode === "edit" ? (
                    <motion.div
                        key="edit"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-10"
                    >
                        <div className="px-4">
                            <PhotoGridEditor photos={photos} setPhotos={setPhotos} dense />
                        </div>
                        <div className="px-4 space-y-3">
                            <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm">
                                <div>
                                    <p className="text-sm font-black">Invisible mode</p>
                                    <p className="text-xs text-muted-foreground">
                                        Browse without appearing in discovery.
                                    </p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={!isProfileVisible}
                                    onChange={() => void toggleVisibility()}
                                    disabled={isSavingPublicFields}
                                    className="h-5 w-5 accent-rose-500"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => void savePublicFields()}
                                disabled={isSavingPublicFields}
                                className="w-full rounded-2xl bg-foreground px-4 py-3 text-xs font-black uppercase tracking-widest text-background disabled:opacity-60"
                            >
                                {isSavingPublicFields ? "Saving" : "Save Profile Changes"}
                            </button>
                            {saveMessage && <p className="px-2 text-xs font-bold text-muted-foreground">{saveMessage}</p>}
                        </div>

                        {/* Aligned Meta */}
                        <div className="px-6 space-y-0.5">
                            <h2 className="text-3xl font-black tracking-tighter leading-tight">
                                {displayName || "User"}
                            </h2>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                                <p className="text-xs font-bold tracking-tight text-muted-foreground/80 lowercase">
                                    {calculateAge(birthDate)}y · {gender}
                                </p>
                            </div>
                        </div>

                        {/* Clean List Items */}
                        <div className="px-4 space-y-10">
                            <section className="space-y-4">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-2">Essential Info</h3>
                                <div className="divide-y divide-border/50 border-y border-border/50">
                                    {[
                                        { label: "Display Name", value: displayName || "Set Name", field: "Name" },
                                        { label: "Username", value: username || "Set username", field: "Username" },
                                        { label: "About Me", value: bio || "Write something about yourself...", field: "About" },
                                        { label: "City", value: city || "Set city", field: "City" },
                                        { label: "Dating Intention", value: intention || "Set intention", field: "Intention" },
                                        { label: "Date of Birth", value: birthDate || "Set Date", field: "Date of Birth" },
                                        { label: "Gender Identity", value: gender, field: "Gender" },
                                        { label: "Looking For", value: genderPreference || "Set preference", field: "Gender Preference" },
                                        { label: "My Interests", value: interests.length > 0 ? interests.join(', ') : "Add interests", field: "Interests" }
                                    ].map((item, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setEditingField(item.field)}
                                            className="w-full flex justify-between items-center py-5 px-2 hover:bg-muted/30 transition-colors text-left group"
                                        >
                                            <div className="space-y-0.5">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{item.label}</p>
                                                <p className="text-base font-bold tracking-tight group-hover:translate-x-1 transition-transform">{item.value}</p>
                                            </div>
                                            <Eye className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                                        </button>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="preview"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="px-6 space-y-6"
                    >
                        <div className="text-center space-y-1 mb-8">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Profile Preview</h3>
                            <p className="text-xs font-medium text-muted-foreground">This is how you appear to the community</p>
                        </div>
                        <div className="max-w-[340px] mx-auto scale-105">
                            <DiscoveryCard
                                user={{
                                    peer_id: "me",
                                    display_name: displayName,
                                    birth_date: birthDate,
                                    photos: photoUrls,
                                    profile_prompt: bio,
                                    bio: bio,
                                }}
                                isLarge
                                isPreview
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
