"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import PageTransition from "./PageTransition";
import PhotoGridEditor from "./PhotoGridEditor";
import TermsOfService from "./TermsOfService";
import PrivacyPolicy from "./PrivacyPolicy";
import { calculateAge, canCompleteAgeGate, hasRequiredPhotos } from "@/lib/onboardingProfile.mjs";
import { HOBBY_OPTIONS } from "@/lib/canvas2Contracts.mjs";
import type { UsernameAvailability } from "@/services/supabase";

type OnboardingStatus = "todo" | "identity" | "waitlist" | "profile" | "completed";

interface OnboardingViewProps {
    onboardingStatus: OnboardingStatus;
    setOnboardingStatus: (status: OnboardingStatus) => void;
    displayName: string;
    setDisplayName: (name: string) => void;
    username: string;
    setUsername: (username: string) => void;
    intention: string;
    setIntention: (intention: string) => void;
    birthDate: string;
    setBirthDate: (date: string) => void;
    gender: string;
    setGender: (gender: string) => void;
    genderPreference: string;
    setGenderPreference: (preference: string) => void;
    timelinePreference: string;
    setTimelinePreference: (preference: string) => void;
    hobbySelections: string[];
    setHobbySelections: (hobbies: string[]) => void;
    movieSearch: string;
    setMovieSearch: (query: string) => void;
    musicSearch: string;
    setMusicSearch: (query: string) => void;
    city: string;
    setCity: (city: string) => void;
    state: string;
    setState: (state: string) => void;
    isAdultChecked: boolean;
    setIsAdultChecked: (checked: boolean) => void;
    photos: (File | string)[];
    setPhotos: (photos: (File | string)[]) => void;
    onCheckUsername: (username: string) => Promise<UsernameAvailability>;
    onCompleteProfile: () => Promise<void>;
    isCompletingProfile: boolean;
    profileError: string | null;
}

const GENDER_OPTIONS = ["Woman", "Man", "Non-binary", "Agender", "Not specified"];
const INTENTION_OPTIONS = [
    { value: "long_term", label: "Long-term" },
    { value: "short_term", label: "Short-term" },
];
const PREFERENCE_OPTIONS = ["Women", "Men", "Non-binary people", "Everyone"];
const FEATURED_HOBBY_LABEL = "Photography";
const TIMELINE_OPTIONS = [
    { value: "daily", label: "Daily", helper: "Prompt after 3 days" },
    { value: "one_week", label: "One week", helper: "Prompt after 7 days" },
    { value: "two_weeks", label: "Two weeks", helper: "Prompt after 14 days" },
    { value: "one_month", label: "One month", helper: "Prompt after 30 days" },
    { value: "two_months", label: "Two months", helper: "Prompt after 60 days" },
];

function hobbyLabel(hobby: string) {
    return hobby
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

export default function OnboardingView({
    onboardingStatus,
    setOnboardingStatus,
    displayName,
    setDisplayName,
    username,
    setUsername,
    intention,
    setIntention,
    birthDate,
    setBirthDate,
    gender,
    setGender,
    genderPreference,
    setGenderPreference,
    timelinePreference,
    setTimelinePreference,
    hobbySelections,
    setHobbySelections,
    movieSearch,
    setMovieSearch,
    musicSearch,
    setMusicSearch,
    city,
    setCity,
    state,
    setState,
    isAdultChecked,
    setIsAdultChecked,
    photos,
    setPhotos,
    onCheckUsername,
    onCompleteProfile,
    isCompletingProfile,
    profileError,
}: OnboardingViewProps) {
    const [day, setDay] = useState(birthDate?.split("-")?.[2] || "");
    const [month, setMonth] = useState(birthDate?.split("-")?.[1] || "");
    const [year, setYear] = useState(birthDate?.split("-")?.[0] || "");
    const [customGender, setCustomGender] = useState("");
    const [usernameStatus, setUsernameStatus] = useState<UsernameAvailability>("invalid");
    const [showToS, setShowToS] = useState(false);
    const [showPrivacy, setShowPrivacy] = useState(false);

    const monthRef = useRef<HTMLInputElement>(null);
    const yearRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const d = Number(day);
        const m = Number(month);
        const y = Number(year);
        const formatted = `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;

        if (
            day.length === 2 &&
            month.length === 2 &&
            year.length === 4 &&
            d >= 1 &&
            d <= 31 &&
            m >= 1 &&
            m <= 12 &&
            y >= 1900
        ) {
            setBirthDate(formatted);
            return;
        }

        setBirthDate("");
    }, [day, month, year, setBirthDate]);

    const age = birthDate ? calculateAge(birthDate) : 0;
    const ageGatePassed = Boolean(birthDate && canCompleteAgeGate(birthDate) && isAdultChecked);
    const underageBlocked = Boolean(birthDate && !canCompleteAgeGate(birthDate));
    const usernameAvailable = usernameStatus === "available";
    const identityReady =
        displayName.trim().length > 0 &&
        usernameAvailable &&
        intention.trim().length > 0 &&
        gender.trim().length > 0 &&
        genderPreference.trim().length > 0 &&
        city.trim().length > 0 &&
        state.trim().length > 0;
    const photosReady = hasRequiredPhotos(photos);

    useEffect(() => {
        const trimmed = username.trim();
        if (!trimmed) {
            return;
        }

        const timer = window.setTimeout(() => {
            void onCheckUsername(trimmed)
                .then(setUsernameStatus)
                .catch(() => setUsernameStatus("taken"));
        }, 1000);

        return () => window.clearTimeout(timer);
    }, [onCheckUsername, username]);

    return (
        <div className="w-full max-w-md space-y-8 px-6">
            {onboardingStatus === "todo" ? (
                <PageTransition currentKey="onboarding-age-gate">
                    <div className="space-y-8 rounded-[32px] border border-border bg-card p-8 text-center shadow-xl">
                        <div className="space-y-3">
                            <h2 className="text-3xl font-black tracking-tight">Age Check</h2>
                            <p className="text-sm font-medium text-muted-foreground">Enter your birth date to continue.</p>
                        </div>

                        <div className="space-y-2 text-left">
                            <label className="ml-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Birth Date</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={2}
                                    value={day}
                                    onChange={(event) => {
                                        const value = event.target.value.replace(/\D/g, "");
                                        setDay(value);
                                        if (value.length === 2) monthRef.current?.focus();
                                    }}
                                    placeholder="DD"
                                    className="w-full rounded-2xl border border-border bg-background px-3 py-4 text-center text-lg font-bold transition-all focus:outline-none focus:ring-2 focus:ring-foreground/20"
                                />
                                <input
                                    ref={monthRef}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={2}
                                    value={month}
                                    onChange={(event) => {
                                        const value = event.target.value.replace(/\D/g, "");
                                        setMonth(value);
                                        if (value.length === 2) yearRef.current?.focus();
                                    }}
                                    placeholder="MM"
                                    className="w-full rounded-2xl border border-border bg-background px-3 py-4 text-center text-lg font-bold transition-all focus:outline-none focus:ring-2 focus:ring-foreground/20"
                                />
                                <input
                                    ref={yearRef}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={4}
                                    value={year}
                                    onChange={(event) => setYear(event.target.value.replace(/\D/g, ""))}
                                    placeholder="YYYY"
                                    className="w-[42%] rounded-2xl border border-border bg-background px-3 py-4 text-center text-lg font-bold transition-all focus:outline-none focus:ring-2 focus:ring-foreground/20"
                                />
                            </div>
                        </div>

                        {birthDate && (
                            <div className={`rounded-2xl border p-4 text-left ${underageBlocked ? "border-red-500/30 bg-red-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}>
                                <p className={`text-sm font-black ${underageBlocked ? "text-red-500" : "text-emerald-600"}`}>
                                    {underageBlocked ? "You must be 18 or older to use Komorembi." : `Age verified: ${age}`}
                                </p>
                                {underageBlocked && (
                                    <p className="mt-1 text-xs font-medium text-muted-foreground">This app cannot continue for users under 18.</p>
                                )}
                            </div>
                        )}

                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={() => setIsAdultChecked(!isAdultChecked)}
                                className="group flex w-full items-center gap-3 py-3 text-left"
                            >
                                <div className={`flex h-6 w-6 items-center justify-center rounded-md border transition-all ${isAdultChecked ? "border-foreground bg-foreground" : "border-border bg-background"}`}>
                                    {isAdultChecked && <CheckCircle2 className="h-4 w-4 text-background" />}
                                </div>
                                <span className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                                    I agree to the rules and confirm my birth date is accurate.
                                </span>
                            </button>
                            <div className="ml-9 flex items-center gap-3">
                                <button type="button" onClick={() => setShowToS(true)} className="text-xs font-bold text-primary hover:underline">
                                    Terms of Service
                                </button>
                                <span className="text-[10px] text-muted-foreground">/</span>
                                <button type="button" onClick={() => setShowPrivacy(true)} className="text-xs font-bold text-primary hover:underline">
                                    Privacy Policy
                                </button>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setOnboardingStatus("identity")}
                            disabled={!ageGatePassed}
                            className={`w-full rounded-full py-4 text-lg font-black shadow-md transition-all ${ageGatePassed
                                ? "bg-foreground text-background hover:scale-[1.02] active:scale-[0.98]"
                                : "cursor-not-allowed bg-muted text-muted-foreground"
                                }`}
                        >
                            Continue
                        </button>
                    </div>
                </PageTransition>
            ) : onboardingStatus === "identity" ? (
                <PageTransition currentKey="onboarding-identity">
                    <div className="space-y-7 rounded-[32px] border border-border bg-card p-8 text-center shadow-xl">
                        <div className="space-y-3">
                            <h2 className="text-3xl font-black tracking-tight">Your Profile</h2>
                            <p className="text-sm font-medium text-muted-foreground">Add the basics people will see first.</p>
                        </div>

                        <div className="space-y-2 text-left">
                            <label className="ml-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Display Name</label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(event) => {
                                    const value = event.target.value.replace(/[^a-zA-Z0-9\s]/g, "");
                                    if (value.length <= 30) setDisplayName(value);
                                }}
                                placeholder="Enter your name"
                                className="w-full rounded-2xl border border-border bg-background px-5 py-4 text-center text-lg font-bold transition-all focus:outline-none focus:ring-2 focus:ring-foreground/20"
                            />
                        </div>

                        <div className="space-y-2 text-left">
                            <label className="ml-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(event) => {
                                    const value = event.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
                                    setUsername(value);
                                    setUsernameStatus(value.trim() ? "checking" : "invalid");
                                }}
                                placeholder="ari_22"
                                className="w-full rounded-2xl border border-border bg-background px-5 py-4 text-center text-lg font-bold transition-all focus:outline-none focus:ring-2 focus:ring-foreground/20"
                            />
                            <p className={`text-xs font-black ${usernameStatus === "available"
                                ? "text-emerald-600"
                                : usernameStatus === "checking"
                                    ? "text-muted-foreground"
                                    : "text-red-500"
                                }`}>
                                {usernameStatus === "available"
                                    ? "Available"
                                    : usernameStatus === "checking"
                                        ? "Checking..."
                                        : usernameStatus === "taken"
                                            ? "Taken"
                                            : usernameStatus === "banned"
                                                ? "Not available"
                                                : "Use 3-20 characters, start with a letter."}
                            </p>
                        </div>

                        <div className="space-y-3 text-left">
                            <label className="ml-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Intention</label>
                            <div className="grid grid-cols-2 gap-2">
                                {INTENTION_OPTIONS.map((option) => {
                                    const selected = intention === option.value;
                                    return (
                                        <button
                                            type="button"
                                            key={option.value}
                                            onClick={() => setIntention(option.value)}
                                            className={`rounded-2xl border px-4 py-3 text-sm font-black transition-all ${selected
                                                ? "border-foreground bg-foreground text-background"
                                                : "border-border bg-background text-foreground hover:border-foreground/30"
                                                }`}
                                        >
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-3 text-left">
                            <label className="ml-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Gender Identity</label>
                            <div className="flex flex-wrap gap-2">
                                {GENDER_OPTIONS.map((option) => {
                                    const selected = gender === option;
                                    return (
                                        <button
                                            type="button"
                                            key={option}
                                            onClick={() => {
                                                setGender(option);
                                                setCustomGender("");
                                            }}
                                            className={`rounded-full border px-4 py-2 text-sm font-black transition-all ${selected
                                                ? "border-foreground bg-foreground text-background"
                                                : "border-border bg-background text-foreground hover:border-foreground/30"
                                                }`}
                                        >
                                            {option}
                                        </button>
                                    );
                                })}
                            </div>
                            <input
                                type="text"
                                value={customGender}
                                onChange={(event) => {
                                    const value = event.target.value.slice(0, 40);
                                    setCustomGender(value);
                                    setGender(value.trim());
                                }}
                                placeholder="Or describe your identity"
                                className="w-full rounded-2xl border border-border bg-background px-5 py-4 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-foreground/20"
                            />
                        </div>

                        <div className="space-y-3 text-left">
                            <label className="ml-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Interested In</label>
                            <div className="flex flex-wrap gap-2">
                                {PREFERENCE_OPTIONS.map((option) => {
                                    const selected = genderPreference === option;
                                    return (
                                        <button
                                            type="button"
                                            key={option}
                                            onClick={() => setGenderPreference(option)}
                                            className={`rounded-full border px-4 py-2 text-sm font-black transition-all ${selected
                                                ? "border-foreground bg-foreground text-background"
                                                : "border-border bg-background text-foreground hover:border-foreground/30"
                                                }`}
                                        >
                                            {option}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-3 text-left">
                            <label className="ml-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                How quickly do you want to move toward meeting someone?
                            </label>
                            <div className="grid grid-cols-1 gap-2">
                                {TIMELINE_OPTIONS.map((option) => {
                                    const selected = timelinePreference === option.value;
                                    return (
                                        <button
                                            type="button"
                                            key={option.value}
                                            onClick={() => setTimelinePreference(option.value)}
                                            className={`rounded-2xl border px-4 py-3 text-left text-sm transition-all ${selected
                                                ? "border-foreground bg-foreground text-background"
                                                : "border-border bg-background text-foreground hover:border-foreground/30"
                                                }`}
                                        >
                                            <span className="block font-black">{option.label}</span>
                                            <span className="block text-xs opacity-70">{option.helper}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-3 text-left">
                            <label className="ml-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Hobbies</label>
                            <div className="flex max-h-40 flex-wrap gap-2 overflow-auto pr-1">
                                {HOBBY_OPTIONS.slice(0, 40).map((hobby) => {
                                    const selected = hobbySelections.includes(hobby);
                                    return (
                                        <button
                                            type="button"
                                            key={hobby}
                                            aria-label={hobby === "photography" ? FEATURED_HOBBY_LABEL : hobbyLabel(hobby)}
                                            onClick={() => {
                                                if (selected) {
                                                    setHobbySelections(hobbySelections.filter((item) => item !== hobby));
                                                    return;
                                                }
                                                setHobbySelections([...hobbySelections, hobby].slice(-6));
                                            }}
                                            className={`rounded-full border px-3 py-2 text-xs font-black transition-all ${selected
                                                ? "border-foreground bg-foreground text-background"
                                                : "border-border bg-background text-foreground hover:border-foreground/30"
                                                }`}
                                        >
                                            {hobbyLabel(hobby)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
                            <div className="space-y-2">
                                <label className="ml-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Movies you love</label>
                                <input
                                    type="search"
                                    value={movieSearch}
                                    onChange={(event) => setMovieSearch(event.target.value)}
                                    placeholder="Search movies"
                                    className="w-full rounded-2xl border border-border bg-background px-5 py-4 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-foreground/20"
                                />
                                <p className="text-xs font-bold text-muted-foreground">Search is temporarily unavailable. You can skip this step and add it later from your profile.</p>
                            </div>
                            <div className="space-y-2">
                                <label className="ml-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Music artists you love</label>
                                <input
                                    type="search"
                                    value={musicSearch}
                                    onChange={(event) => setMusicSearch(event.target.value)}
                                    placeholder="Search artists"
                                    className="w-full rounded-2xl border border-border bg-background px-5 py-4 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-foreground/20"
                                />
                                <p className="text-xs font-bold text-muted-foreground">Search is temporarily unavailable. You can skip this step and add it later from your profile.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
                            <div className="space-y-2">
                                <label className="ml-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">City</label>
                                <input
                                    type="text"
                                    value={city}
                                    onChange={(event) => setCity(event.target.value.slice(0, 60))}
                                    placeholder="Mumbai"
                                    className="w-full rounded-2xl border border-border bg-background px-5 py-4 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-foreground/20"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="ml-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">State</label>
                                <input
                                    type="text"
                                    value={state}
                                    onChange={(event) => setState(event.target.value.slice(0, 60))}
                                    placeholder="Maharashtra"
                                    className="w-full rounded-2xl border border-border bg-background px-5 py-4 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-foreground/20"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 pt-2">
                            <button
                                type="button"
                                onClick={() => setOnboardingStatus("todo")}
                                className="flex-1 rounded-full bg-muted/70 py-4 text-lg font-bold text-muted-foreground transition-all hover:bg-muted"
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                onClick={() => setOnboardingStatus("profile")}
                                disabled={!identityReady}
                                className={`flex-[2] rounded-full py-4 text-lg font-black shadow-lg transition-all ${identityReady
                                    ? "bg-foreground text-background hover:scale-[1.02] active:scale-[0.98]"
                                    : "cursor-not-allowed bg-muted text-muted-foreground"
                                    }`}
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </PageTransition>
            ) : onboardingStatus === "profile" ? (
                <PageTransition currentKey="onboarding-photos">
                        <div className="space-y-6 rounded-[32px] border border-border bg-card p-6 text-center shadow-xl">
                        <div className="space-y-2 px-2">
                            <h2 className="text-3xl font-black tracking-tight">Add Photos</h2>
                            <p className="text-sm font-medium text-muted-foreground">Upload at least two photos. You can add up to six.</p>
                        </div>

                        <PhotoGridEditor photos={photos} setPhotos={setPhotos} />

                        {!photosReady && (
                            <div className="flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-left">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                <p className="text-xs font-bold text-muted-foreground">At least two cropped profile photos are required before discovery.</p>
                            </div>
                        )}

                        {profileError && (
                            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-left">
                                <p className="text-xs font-bold text-red-500">{profileError}</p>
                            </div>
                        )}

                        <div className="flex gap-4 pt-2">
                            <button
                                type="button"
                                onClick={() => setOnboardingStatus("identity")}
                                disabled={isCompletingProfile}
                                className="flex-1 rounded-full bg-muted/70 py-4 text-lg font-bold text-muted-foreground transition-all hover:bg-muted disabled:opacity-50"
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                onClick={onCompleteProfile}
                                disabled={!photosReady || isCompletingProfile}
                                className={`flex-[2] rounded-full py-4 text-lg font-black shadow-md transition-all ${photosReady && !isCompletingProfile
                                    ? "bg-foreground text-background hover:scale-[1.02] active:scale-[0.98]"
                                    : "cursor-not-allowed bg-muted text-muted-foreground"
                                    }`}
                            >
                                {isCompletingProfile ? (
                                    <span className="inline-flex items-center justify-center gap-2">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Saving
                                    </span>
                                ) : (
                                    "Save Profile"
                                )}
                            </button>
                        </div>
                    </div>
                </PageTransition>
            ) : null}

            <AnimatePresence>
                {showToS && (
                    <motion.div
                        initial={{ opacity: 0, y: "100%" }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed inset-0 z-[100] bg-background pt-[env(safe-area-inset-top)]"
                    >
                        <TermsOfService onClose={() => setShowToS(false)} />
                    </motion.div>
                )}
                {showPrivacy && (
                    <motion.div
                        initial={{ opacity: 0, y: "100%" }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed inset-0 z-[100] bg-background pt-[env(safe-area-inset-top)]"
                    >
                        <PrivacyPolicy onClose={() => setShowPrivacy(false)} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
