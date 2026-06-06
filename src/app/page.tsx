"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Home as HomeIcon, User, Menu, MessageCircle, Heart } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
    checkUsernameAvailability,
    completeOnboardingProfile,
    discoverProfiles,
    discoverWaitlistPreview,
    loadFeedFilters,
    loadOnboardingProgress,
    loadOwnWaitlistEntry,
    leaveWaitlist,
    queueOnboardingInterestReminder,
    recordCurrentDeviceSession,
    saveFeedFilters,
    saveProfileInterests,
    saveOnboardingProgress,
    sendOpeningMessage,
    setTimelinePreference as saveTimelinePreference,
    submitReport,
    supabase,
    type DiscoveryProfile,
    type FeedFilters,
    type WaitlistPreviewCard,
} from "@/services/supabase";
import {
    calculateAge as calculateProfileAge,
    canCompleteAgeGate,
    hasRequiredPhotos,
} from "@/lib/onboardingProfile.mjs";
import { deriveThemeModeFromIntention } from "@/lib/canvas2Contracts.mjs";
import { DEFAULT_FEED_FILTERS, DISCOVERY_PAGE_SIZE, createDiscoverySessionId } from "@/lib/discoveryFeed.mjs";
import { MESSAGE_MAX_CHARACTERS, validateMessageContent } from "@/lib/messaging.mjs";
import { REPORT_SUBMISSION_CONFIRMATION } from "@/lib/reportsSafety.mjs";
import { useAppBoot } from "@/hooks/useAppBoot";
import OnboardingView from "@/components/OnboardingView";
import DiscoveryFeed from "@/components/DiscoveryFeed";
import ProfileView from "@/components/ProfileView";
import SettingsView from "@/components/SettingsView";
import UserProfileDetail from "@/components/UserProfileDetail";
import FieldEditor from "@/components/FieldEditor";
import ChatView from "@/components/ChatView";
import LandingPage from "@/components/LandingPage";
import DiscoveryInterestPrompt from "@/components/DiscoveryInterestPrompt";
import WaitlistView from "@/components/WaitlistView";
import ReportProfileSheet from "@/components/ReportProfileSheet";

const PROFILE_CACHE_KEY = "komorembi_profile_cache";

type AppView = "feed" | "chats" | "profile" | "settings";
type OnboardingStatus = "todo" | "identity" | "profile" | "waitlist" | "completed";

export default function Home() {
    const [authUserId, setAuthUserId] = useState<string | null>(null);
    const [authSessionReady, setAuthSessionReady] = useState(false);
    const isAuthenticated = Boolean(authUserId);
    const { bootState, deviceId, banMessage } = useAppBoot({
        sessionReady: authSessionReady,
        isAuthenticated,
    });
    const recordedDeviceSessionRef = useRef<string | null>(null);

    const [view, setView] = useState<AppView>("feed");
    const [mounted, setMounted] = useState(false);
    const [peerId, setPeerId] = useState<string | null>(null);
    const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus>("todo");
    const [isProfileLoaded, setIsProfileLoaded] = useState(false);

    const [pronouns, setPronouns] = useState("she/her");
    const [gender, setGender] = useState("");
    const [sexuality, setSexuality] = useState("Bisexual");
    const [interestedIn, setInterestedIn] = useState("Women");
    const [work, setWork] = useState("Pilates Instructor");
    const [username, setUsername] = useState("");
    const [intention, setIntention] = useState("");
    const [genderPreference, setGenderPreference] = useState("");
    const [timelinePreference, setTimelinePreference] = useState("one_week");
    const [hobbySelections, setHobbySelections] = useState<string[]>([]);
    const [movieSearch, setMovieSearch] = useState("");
    const [musicSearch, setMusicSearch] = useState("");
    const [movieSelections] = useState<any[]>([]);
    const [musicSelections] = useState<any[]>([]);
    const [city, setCity] = useState("");
    const [locationState, setLocationState] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [birthDate, setBirthDate] = useState("");
    const [isAdultChecked, setIsAdultChecked] = useState(false);
    const [photos, setPhotos] = useState<(File | string)[]>([]);
    const [interests, setInterests] = useState<string[]>([]);
    const [bio, setBio] = useState("");
    const [isCompletingProfile, setIsCompletingProfile] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);
    const [fieldVisibility, setFieldVisibility] = useState<Record<string, boolean>>({});
    const [editingField, setEditingField] = useState<string | null>(null);

    const [discoveryUsers, setDiscoveryUsers] = useState<DiscoveryProfile[]>([]);
    const [selectedUser, setSelectedUser] = useState<DiscoveryProfile | null>(null);
    const [feedFilters, setFeedFilters] = useState<FeedFilters>(DEFAULT_FEED_FILTERS);
    const [feedSessionId, setFeedSessionId] = useState(() => createDiscoverySessionId());
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [isLoadingMoreDiscovery, setIsLoadingMoreDiscovery] = useState(false);
    const [hasMoreDiscovery, setHasMoreDiscovery] = useState(true);
    const [showDiscoveryInterestPrompt, setShowDiscoveryInterestPrompt] = useState(false);

    const [waitlistPreviewCards, setWaitlistPreviewCards] = useState<WaitlistPreviewCard[]>([]);
    const [waitlistQueuePosition, setWaitlistQueuePosition] = useState<number | null>(null);

    const [reportTargetPeerId, setReportTargetPeerId] = useState<string | null>(null);
    const [isSubmittingReport, setIsSubmittingReport] = useState(false);
    const [matchNotification, setMatchNotification] = useState<{ name: string; isOpen: boolean }>({ name: "", isOpen: false });
    const themeMode = deriveThemeModeFromIntention(intention) as "calm" | "bold";

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        let cancelled = false;

        const resolveSession = async () => {
            const { data } = await supabase.auth.getSession();
            if (cancelled) return;
            setAuthUserId(data.session?.user?.id ?? null);
            setAuthSessionReady(true);
        };

        void resolveSession();

        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
            setAuthUserId(session?.user?.id ?? null);
            setAuthSessionReady(true);
        });

        return () => {
            cancelled = true;
            data.subscription.unsubscribe();
        };
    }, []);

    const handleAuthenticated = useCallback((userId: string) => {
        setAuthUserId(userId);
    }, []);

    useEffect(() => {
        if (!authUserId || !deviceId) return;

        const recordKey = `${authUserId}:${deviceId}`;
        if (recordedDeviceSessionRef.current === recordKey) return;
        recordedDeviceSessionRef.current = recordKey;

        void recordCurrentDeviceSession(deviceId, "web").catch((err) => {
            console.warn("Device session record failed", err);
            recordedDeviceSessionRef.current = null;
        });
    }, [authUserId, deviceId]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const cachedParams = window.localStorage.getItem(PROFILE_CACHE_KEY);
        if (cachedParams) {
            try {
                const p = JSON.parse(cachedParams);
                if (p.peerId) setPeerId(String(p.peerId));
                if (p.displayName) setDisplayName(p.displayName);
                if (p.username) setUsername(p.username);
                if (p.intention) setIntention(p.intention);
                if (p.birthDate) setBirthDate(p.birthDate);
                if (Array.isArray(p.interests)) setInterests(p.interests);
                if (p.pronouns) setPronouns(p.pronouns);
                if (p.gender) setGender(p.gender);
                if (p.genderPreference) setGenderPreference(p.genderPreference);
                if (p.timelinePreference) setTimelinePreference(p.timelinePreference);
                if (Array.isArray(p.hobbySelections)) setHobbySelections(p.hobbySelections);
                if (p.movieSearch) setMovieSearch(p.movieSearch);
                if (p.musicSearch) setMusicSearch(p.musicSearch);
                if (p.city) setCity(p.city);
                if (p.locationState) setLocationState(p.locationState);
                if (p.sexuality) setSexuality(p.sexuality);
                if (p.interestedIn) setInterestedIn(p.interestedIn);
                if (p.work) setWork(p.work);
                if (p.bio) setBio(p.bio);
                if (Array.isArray(p.photos)) setPhotos(p.photos.filter((photo: unknown) => typeof photo === "string"));
                if (p.isAdultChecked) setIsAdultChecked(p.isAdultChecked);
                if (p.displayName && p.username && p.intention && p.genderPreference && p.city && p.locationState && p.birthDate && canCompleteAgeGate(p.birthDate) && hasRequiredPhotos(p.photos || [])) {
                    setOnboardingStatus("completed");
                    setView("feed");
                }
            } catch {
                window.localStorage.removeItem(PROFILE_CACHE_KEY);
            }
        }
        setIsProfileLoaded(true);
    }, []);

    useEffect(() => {
        if (isProfileLoaded && displayName && typeof window !== "undefined") {
            window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
                peerId,
                displayName,
                username,
                intention,
                birthDate,
                interests,
                pronouns,
                gender,
                genderPreference,
                timelinePreference,
                hobbySelections,
                movieSearch,
                musicSearch,
                city,
                locationState,
                sexuality,
                interestedIn,
                work,
                bio,
                isAdultChecked,
                photos: photos.filter((photo): photo is string => typeof photo === "string"),
            }));
        }
    }, [bio, birthDate, city, displayName, gender, genderPreference, hobbySelections, intention, interestedIn, interests, isAdultChecked, isProfileLoaded, locationState, movieSearch, musicSearch, peerId, photos, pronouns, sexuality, timelinePreference, username, work]);

    useEffect(() => {
        if (!authUserId || !isProfileLoaded) return;

        let cancelled = false;
        void loadOnboardingProgress(authUserId)
            .then((progress) => {
                if (cancelled || !progress) return;

                const draft = (progress.draft_profile || {}) as Record<string, any>;
                if (draft.displayName) setDisplayName(String(draft.displayName));
                if (draft.username) setUsername(String(draft.username));
                if (draft.intention) setIntention(String(draft.intention));
                if (draft.birthDate) setBirthDate(String(draft.birthDate));
                if (draft.gender) setGender(String(draft.gender));
                if (draft.genderPreference) setGenderPreference(String(draft.genderPreference));
                if (draft.timelinePreference) setTimelinePreference(String(draft.timelinePreference));
                if (Array.isArray(draft.hobbySelections)) setHobbySelections(draft.hobbySelections.map(String));
                if (draft.movieSearch) setMovieSearch(String(draft.movieSearch));
                if (draft.musicSearch) setMusicSearch(String(draft.musicSearch));
                if (draft.city) setCity(String(draft.city));
                if (draft.locationState) setLocationState(String(draft.locationState));
                if (draft.bio) setBio(String(draft.bio));

                if (["todo", "identity", "profile", "waitlist", "completed"].includes(progress.current_step)) {
                    setOnboardingStatus(progress.current_step as OnboardingStatus);
                }
            })
            .catch((err) => console.warn("Onboarding progress load failed", err));

        return () => {
            cancelled = true;
        };
    }, [authUserId, isProfileLoaded]);

    useEffect(() => {
        if (!authUserId || !isProfileLoaded || onboardingStatus === "completed") return;

        const timer = window.setTimeout(() => {
            void saveOnboardingProgress({
                userId: authUserId,
                currentStep: onboardingStatus,
                draftProfile: {
                    displayName,
                    username,
                    intention,
                    birthDate,
                    gender,
                    genderPreference,
                    timelinePreference,
                    hobbySelections,
                    movieSearch,
                    musicSearch,
                    city,
                    locationState,
                    bio,
                },
            }).catch((err) => console.warn("Onboarding progress save failed", err));
        }, 600);

        return () => window.clearTimeout(timer);
    }, [authUserId, bio, birthDate, city, displayName, gender, genderPreference, hobbySelections, intention, isProfileLoaded, locationState, movieSearch, musicSearch, onboardingStatus, timelinePreference, username]);

    useEffect(() => {
        if (!authUserId || onboardingStatus !== "completed") return;

        let cancelled = false;
        void loadFeedFilters(themeMode === "bold" ? "short_term" : "long_term")
            .then((filters) => {
                if (!cancelled) setFeedFilters(filters);
            })
            .catch((err) => console.warn("Feed filter load failed", err));

        return () => {
            cancelled = true;
        };
    }, [authUserId, onboardingStatus, themeMode]);

    const fetchDiscoveryUsers = useCallback(async ({ append = false }: { append?: boolean } = {}) => {
        if (onboardingStatus !== "completed") return;

        const nextSessionId = append ? feedSessionId : createDiscoverySessionId();
        if (!append) {
            setFeedSessionId(nextSessionId);
            setIsDiscovering(true);
        } else {
            setIsLoadingMoreDiscovery(true);
        }

        try {
            const profiles = await discoverProfiles({
                filters: feedFilters,
                sessionId: nextSessionId,
                limit: DISCOVERY_PAGE_SIZE,
                datingMode: themeMode === "bold" ? "short_term" : "long_term",
            });
            setDiscoveryUsers((current) => (append ? [...current, ...profiles] : profiles));
            setHasMoreDiscovery(profiles.length === DISCOVERY_PAGE_SIZE);
        } catch (err) {
            console.error("Discovery fetch failed", err);
            if (!append) setDiscoveryUsers([]);
            setHasMoreDiscovery(false);
        } finally {
            setIsDiscovering(false);
            setIsLoadingMoreDiscovery(false);
        }
    }, [feedSessionId, feedFilters, onboardingStatus, themeMode]);

    useEffect(() => {
        if (onboardingStatus !== "completed") return;
        void fetchDiscoveryUsers();
    }, [fetchDiscoveryUsers, onboardingStatus]);

    useEffect(() => {
        if (onboardingStatus !== "completed") return;
        void saveFeedFilters(feedFilters, themeMode === "bold" ? "short_term" : "long_term").catch((err) => console.warn("Feed filter save failed", err));
    }, [feedFilters, onboardingStatus, themeMode]);

    const refreshWaitlistState = useCallback(async () => {
        const [preview, entry] = await Promise.all([
            discoverWaitlistPreview(20, themeMode === "bold" ? "short_term" : "long_term"),
            loadOwnWaitlistEntry(themeMode === "bold" ? "short_term" : "long_term"),
        ]);
        setWaitlistPreviewCards(preview);
        setWaitlistQueuePosition(entry?.queue_position ?? null);
    }, [themeMode]);

    const handleCompleteProfile = useCallback(async () => {
        setProfileError(null);
        if (!authUserId) {
            setProfileError("Log in with phone before creating a profile.");
            return;
        }

        if (!canCompleteAgeGate(birthDate)) {
            setProfileError("You must be at least 18 to create a profile.");
            return;
        }

        if (!displayName.trim() || !username.trim() || !intention.trim() || !gender.trim() || !genderPreference.trim() || !city.trim() || !locationState.trim()) {
            setProfileError("Complete username, intention, name, gender, preference, city, and state.");
            return;
        }

        if (!hasRequiredPhotos(photos)) {
            setProfileError("Add at least two profile photos.");
            return;
        }

        setIsCompletingProfile(true);
        try {
            const completedProfile = await completeOnboardingProfile({
                peerId: peerId || authUserId,
                username,
                displayName,
                birthDate,
                gender,
                genderPreference,
                intention,
                city,
                state: locationState,
                bio,
                photos,
            });

            const nextPeerId = completedProfile?.peer_id || peerId || authUserId;
            await saveTimelinePreference(timelinePreference);
            await saveProfileInterests({
                hobbies: hobbySelections,
                movies: movieSelections,
                musicArtists: musicSelections,
            });
            if (movieSelections.length === 0 || musicSelections.length === 0) {
                await queueOnboardingInterestReminder({
                    userId: authUserId,
                    signupCompletedAt: new Date().toISOString(),
                    skippedMovies: movieSelections.length === 0,
                    skippedMusic: musicSelections.length === 0,
                });
            }
            setPeerId(nextPeerId);
            setPhotos(photos.slice(0, 6));
            const nextStatus = completedProfile?.is_waitlisted ? "waitlist" : "completed";
            setOnboardingStatus(nextStatus);
            if (nextStatus === "waitlist") {
                await refreshWaitlistState();
            } else {
                setView("feed");
            }
        } catch (err: any) {
            setProfileError(err.message || "Could not complete your profile. Try again.");
        } finally {
            setIsCompletingProfile(false);
        }
    }, [authUserId, bio, birthDate, city, displayName, gender, genderPreference, hobbySelections, intention, locationState, movieSelections, musicSelections, peerId, photos, refreshWaitlistState, timelinePreference, username]);

    const handleLeaveWaitlist = async () => {
        await leaveWaitlist();
        setOnboardingStatus("profile");
        setWaitlistPreviewCards([]);
        setWaitlistQueuePosition(null);
    };

    const calculateAge = (dateString: string) => calculateProfileAge(dateString);

    const saveDiscoveryInterests = (nextInterests: string[]) => {
        setInterests(nextInterests);
        setShowDiscoveryInterestPrompt(false);
    };

    const markDiscoveryInterestPromptSeen = () => {
        setShowDiscoveryInterestPrompt(false);
    };

    const handlePass = async (targetPeerId: string) => {
        setDiscoveryUsers((current) => current.filter((profile) => profile.peer_id !== targetPeerId));
        setSelectedUser(null);
    };

    const handleLike = async (userObj: DiscoveryProfile) => {
        const openingMessage = window.prompt(
            `Write your opening message to ${userObj.display_name.split(",")[0] || "this person"}`,
            "",
        );
        const validation = validateMessageContent(openingMessage);
        if (!validation.ok) {
            window.alert(
                validation.reason === "too_long"
                    ? `Opening messages must be ${MESSAGE_MAX_CHARACTERS} characters or fewer.`
                    : "Write a message before sending.",
            );
            return;
        }
        const openingText = validation.text || "";

        try {
            const data = await sendOpeningMessage(userObj.peer_id, openingText);
            if (data && typeof data === "object" && "success" in data) {
                setSelectedUser(null);
                setView("feed");
                setDiscoveryUsers((current) => current.filter((profile) => profile.peer_id !== userObj.peer_id));
                setMatchNotification({ name: "Message Sent", isOpen: true });
                window.setTimeout(() => setMatchNotification((prev) => ({ ...prev, isOpen: false })), 3000);
            }
        } catch (err) {
            console.error("Error sending opening message:", err);
            window.alert(err instanceof Error ? err.message : "Could not send that message. Try again in a moment.");
        }
    };

    const handleReport = (targetPeerId?: string) => {
        const idToReport = targetPeerId;
        if (!idToReport || !peerId) return;
        setReportTargetPeerId(idToReport);
    };

    const handleSubmitReport = async ({
        targetPeerId,
        reason,
        details,
    }: {
        targetPeerId: string;
        reason: string;
        details: string | null;
    }) => {
        setIsSubmittingReport(true);

        try {
            await submitReport({
                reportedPeerId: targetPeerId,
                reason,
                details,
            });
            setReportTargetPeerId(null);
            window.alert(REPORT_SUBMISSION_CONFIRMATION);
        } catch (err) {
            console.error("Report submission failed", err);
            window.alert(err instanceof Error ? err.message : "Could not submit that report. Try again.");
        } finally {
            setIsSubmittingReport(false);
        }
    };

    if (!mounted) {
        return (
            <div className="fixed inset-0 bg-blue-600 flex flex-col items-center justify-center p-6 text-white text-center">
                <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
                <h1 className="text-2xl font-bold mb-2">Komorembi</h1>
                <p className="opacity-80">Initializing environment...</p>
            </div>
        );
    }

    if (bootState === "booting") {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
                <div className="w-12 h-12 rounded-full border-4 border-rose-500/20 border-t-rose-500 animate-spin mb-4" />
                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest animate-pulse">Loading Interface</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <LandingPage onAuthenticated={handleAuthenticated} />;
    }

    if (bootState === "blocked") {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 text-center space-y-6">
                <div className="w-24 h-24 bg-rose-500/20 rounded-full flex items-center justify-center animate-pulse">
                    <Menu className="w-12 h-12 text-rose-500" />
                </div>
                <h1 className="text-4xl font-black tracking-tighter text-white">ACCESS DENIED</h1>
                <p className="text-rose-200/60 max-w-xs font-medium">
                    {banMessage || "This device has been permanently flagged for violating community safety guidelines."}
                </p>
                <div className="pt-8 text-[10px] text-white/20 font-mono tracking-widest uppercase">
                    Device ID: {deviceId?.slice(0, 8)}...
                </div>
            </div>
        );
    }

    return (
        <div className={`theme-${themeMode} min-h-screen bg-background text-foreground font-sans overflow-x-hidden selection:bg-rose-500/30`}>
            <main className={`${onboardingStatus !== "completed" ? "flex flex-col items-center justify-center py-10" : "pt-[env(safe-area-inset-top)] pb-[max(env(safe-area-inset-bottom),80px)]"}`}>
                <div className={`w-full ${onboardingStatus !== "completed" ? "max-w-md" : "max-w-3xl mx-auto px-3 sm:px-6"}`}>
                    <AnimatePresence mode="wait">
                        {onboardingStatus === "waitlist" ? (
                            <WaitlistView
                                onBack={() => setOnboardingStatus("profile")}
                                onLeaveWaitlist={handleLeaveWaitlist}
                                previewCards={waitlistPreviewCards}
                                queuePosition={waitlistQueuePosition}
                                referralUrl={`https://komorembi.app/invite?ref=${encodeURIComponent(peerId || authUserId || "")}`}
                            />
                        ) : onboardingStatus !== "completed" ? (
                            <OnboardingView
                                onboardingStatus={onboardingStatus}
                                setOnboardingStatus={setOnboardingStatus}
                                displayName={displayName}
                                setDisplayName={setDisplayName}
                                username={username}
                                setUsername={setUsername}
                                intention={intention}
                                setIntention={setIntention}
                                birthDate={birthDate}
                                setBirthDate={setBirthDate}
                                gender={gender}
                                setGender={setGender}
                                genderPreference={genderPreference}
                                setGenderPreference={setGenderPreference}
                                timelinePreference={timelinePreference}
                                setTimelinePreference={setTimelinePreference}
                                hobbySelections={hobbySelections}
                                setHobbySelections={setHobbySelections}
                                movieSearch={movieSearch}
                                setMovieSearch={setMovieSearch}
                                musicSearch={musicSearch}
                                setMusicSearch={setMusicSearch}
                                city={city}
                                setCity={setCity}
                                state={locationState}
                                setState={setLocationState}
                                isAdultChecked={isAdultChecked}
                                setIsAdultChecked={setIsAdultChecked}
                                photos={photos}
                                setPhotos={setPhotos}
                                onCheckUsername={checkUsernameAvailability}
                                onCompleteProfile={handleCompleteProfile}
                                isCompletingProfile={isCompletingProfile}
                                profileError={profileError}
                            />
                        ) : selectedUser ? (
                            <UserProfileDetail
                                selectedUser={selectedUser}
                                setSelectedUser={setSelectedUser}
                                handleLike={handleLike}
                                onPass={handlePass}
                                onReport={handleReport}
                            />
                        ) : editingField ? (
                            <FieldEditor
                                editingField={editingField}
                                setEditingField={setEditingField}
                                pronouns={pronouns}
                                setPronouns={setPronouns}
                                interests={interests}
                                setInterests={setInterests}
                                gender={gender}
                                setGender={setGender}
                                sexuality={sexuality}
                                setSexuality={setSexuality}
                                interestedIn={interestedIn}
                                setInterestedIn={setInterestedIn}
                                work={work}
                                setWork={setWork}
                                username={username}
                                setUsername={setUsername}
                                intention={intention}
                                setIntention={setIntention}
                                genderPreference={genderPreference}
                                setGenderPreference={setGenderPreference}
                                city={city}
                                setCity={setCity}
                                state={locationState}
                                setState={setLocationState}
                                displayName={displayName}
                                setDisplayName={setDisplayName}
                                birthDate={birthDate}
                                setBirthDate={setBirthDate}
                                fieldVisibility={fieldVisibility}
                                setFieldVisibility={setFieldVisibility}
                                bio={bio}
                                setBio={setBio}
                            />
                        ) : view === "profile" ? (
                            <ProfileView
                                displayName={displayName}
                                birthDate={birthDate}
                                interests={interests}
                                calculateAge={calculateAge}
                                photos={photos}
                                setPhotos={setPhotos}
                                setOnboardingStatus={setOnboardingStatus}
                                setEditingField={setEditingField}
                                gender={gender}
                                username={username}
                                intention={intention}
                                genderPreference={genderPreference}
                                city={city}
                                currentPeerId={peerId || ""}
                                bio={bio}
                                setBio={setBio}
                            />
                        ) : view === "settings" ? (
                            <SettingsView
                                currentPeerId={peerId || ""}
                            />
                        ) : view === "chats" ? (
                            <ChatView
                                currentPeerId={peerId || ""}
                                onReport={handleReport}
                            />
                        ) : (
                            <DiscoveryFeed
                                isDiscovering={isDiscovering}
                                isLoadingMore={isLoadingMoreDiscovery}
                                hasMore={hasMoreDiscovery}
                                discoveryUsers={discoveryUsers}
                                feedFilters={feedFilters}
                                setFeedFilters={setFeedFilters}
                                setSelectedUser={setSelectedUser}
                                onRefresh={fetchDiscoveryUsers}
                                onLoadMore={() => fetchDiscoveryUsers({ append: true })}
                                onReport={handleReport}
                                themeMode={themeMode}
                            />
                        )}
                    </AnimatePresence>
                </div>

                {showDiscoveryInterestPrompt && onboardingStatus === "completed" && view === "feed" && (
                    <DiscoveryInterestPrompt
                        initialInterests={interests}
                        onSave={saveDiscoveryInterests}
                        onSkip={markDiscoveryInterestPromptSeen}
                    />
                )}

                {onboardingStatus === "completed" && (
                    <div className="fixed bottom-[max(env(safe-area-inset-bottom),16px)] left-1/2 -translate-x-1/2 z-50 w-max">
                        <nav className="flex items-center bg-black/90 backdrop-blur-3xl border border-white/10 px-2 py-2 rounded-[32px] shadow-2xl transition-all">
                            {[
                                { id: "feed", icon: HomeIcon, action: () => setView("feed") },
                                { id: "chats", icon: MessageCircle, action: () => setView("chats") },
                                { id: "profile", icon: User, action: () => setView("profile") },
                                { id: "settings", icon: Menu, action: () => setView("settings") },
                            ].map((item) => {
                                const Icon = item.icon;
                                const isActive = view === item.id;
                                return (
                                    <motion.button
                                        key={item.id}
                                        onClick={item.action}
                                        whileTap={{ scale: 0.9 }}
                                        className={`relative w-12 h-12 flex items-center justify-center rounded-2xl transition-all ${isActive ? "text-white" : "text-white/40 hover:text-white/60"}`}
                                    >
                                        {isActive && (
                                            <motion.div
                                                layoutId="activeNavTab"
                                                className="absolute inset-0 rounded-2xl bg-white/5"
                                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                            />
                                        )}
                                        <Icon className="relative z-10 w-5 h-5" />
                                    </motion.button>
                                );
                            })}
                        </nav>
                    </div>
                )}

                <AnimatePresence>
                    {matchNotification.isOpen && (
                        <motion.div
                            initial={{ y: 50, opacity: 0, scale: 0.9 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: 20, opacity: 0, scale: 0.9 }}
                            className="fixed bottom-[100px] left-1/2 -translate-x-1/2 z-[200] p-4 pointer-events-none w-full max-w-sm"
                        >
                            <div className="mx-auto bg-black/90 backdrop-blur-xl p-3 rounded-full shadow-[0_0_40px_rgba(244,63,94,0.3)] border border-white/10 flex items-center gap-3 pointer-events-auto">
                                <div className="w-8 h-8 bg-rose-500/20 rounded-full flex items-center justify-center shrink-0 text-rose-500">
                                    <Heart className="w-4 h-4 fill-current animate-pulse" />
                                </div>
                                <div className="flex-1 min-w-0 pr-2">
                                    <p className="text-white text-[11px] font-bold truncate">
                                        <span className="text-rose-500">{matchNotification.name}</span>
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setView("chats");
                                        setMatchNotification((prev) => ({ ...prev, isOpen: false }));
                                    }}
                                    className="px-4 py-1.5 bg-rose-500 text-white rounded-full text-[9px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shrink-0"
                                >
                                    Chat
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <ReportProfileSheet
                    isOpen={Boolean(reportTargetPeerId)}
                    targetPeerId={reportTargetPeerId}
                    isSubmitting={isSubmittingReport}
                    onClose={() => {
                        if (!isSubmittingReport) setReportTargetPeerId(null);
                    }}
                    onSubmit={handleSubmitReport}
                />
            </main>
        </div>
    );
}
