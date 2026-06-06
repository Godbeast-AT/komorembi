"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import {
    buildPhoneOtpRequest,
    buildPhoneOtpVerification,
    isSixDigitOtp,
    normalizePhoneNumber,
} from "@/lib/authLifecycle.mjs";
import { signInWithGoogle, supabase, upsertCurrentUserAuthRecord } from "@/services/supabase";

type LandingPageProps = {
    onAuthenticated: (userId: string) => Promise<void> | void;
};

function describeAuthError(errorCode: string) {
    if (errorCode === "invalid_phone_number") return "Enter a valid Indian phone number.";
    if (errorCode === "invalid_otp") return "Enter the 6-digit OTP code.";
    return "Phone login failed. Please try again.";
}

export default function LandingPage({ onAuthenticated }: LandingPageProps) {
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const phoneIsValid = Boolean(normalizePhoneNumber(phone));
    const otpIsValid = isSixDigitOtp(otp.trim());

    const handleSendOtp = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { error: otpError } = await supabase.auth.signInWithOtp(buildPhoneOtpRequest(phone));
            if (otpError) throw otpError;
            setOtpSent(true);
        } catch (err: any) {
            setError(describeAuthError(err.message || String(err)));
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const verification = buildPhoneOtpVerification(phone, otp);
            const { data, error: verifyError } = await supabase.auth.verifyOtp(
                {
                    phone: verification.phone,
                    token: verification.token,
                    type: "sms",
                },
            );
            if (verifyError) throw verifyError;

            const userId = data.session?.user?.id || data.user?.id;
            if (!userId) throw new Error("Phone login returned no user session.");
            await upsertCurrentUserAuthRecord({ userId, phone });
            await onAuthenticated(userId);
        } catch (err: any) {
            setError(describeAuthError(err.message || String(err)));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (otpSent) {
            void handleVerifyOtp();
            return;
        }
        void handleSendOtp();
    };

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await signInWithGoogle();
        } catch (err: any) {
            setError(err.message || "Google login failed. Please try again.");
            setIsLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#0A0A0B] text-white flex items-center justify-center px-6">
            <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
                <div className="space-y-2 text-center">
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-rose-300">
                        Komorebi
                    </p>
                    <h1 className="text-3xl font-black tracking-tight">Log in with phone</h1>
                    <p className="text-sm font-medium text-white/55">
                        We will send a 6-digit OTP to verify your account.
                    </p>
                </div>

                <div className="space-y-4">
                    <label htmlFor="phone-number" className="block text-xs font-black uppercase tracking-widest text-white/60">
                        Phone number
                    </label>
                    <input
                        id="phone-number"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-4 text-base font-bold text-white outline-none transition focus:border-rose-300 focus:bg-white/[0.09]"
                    />

                    {otpSent && (
                        <div className="space-y-3">
                            <label htmlFor="otp-code" className="block text-xs font-black uppercase tracking-widest text-white/60">
                                OTP code
                            </label>
                            <input
                                id="otp-code"
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={6}
                                value={otp}
                                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                                placeholder="123456"
                                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-4 text-base font-bold tracking-[0.32em] text-white outline-none transition focus:border-rose-300 focus:bg-white/[0.09]"
                            />
                        </div>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={isLoading || !phoneIsValid || (otpSent && !otpIsValid)}
                    className="w-full min-h-[56px] inline-flex items-center justify-center rounded-2xl bg-white px-6 py-4 text-base font-black text-[#0A0A0B] shadow-[0_20px_60px_rgba(255,255,255,0.12)] transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
                >
                    {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />}
                    {otpSent ? "Verify OTP" : "Send OTP"}
                </button>

                <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="w-full min-h-[52px] inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] px-6 py-4 text-sm font-black text-white transition-all hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-70"
                >
                    Continue with Google
                </button>

                {error && (
                    <p className="mt-4 text-center text-xs font-semibold text-red-300">
                        {error}
                    </p>
                )}
            </form>
        </main>
    );
}
