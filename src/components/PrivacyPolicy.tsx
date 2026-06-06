"use client";

import React from 'react';
import { X, Lock, Eye, HeartHandshake, UserCheck, Info } from 'lucide-react';

interface PrivacyPolicyProps {
    onClose: () => void;
}

export default function PrivacyPolicy({ onClose }: PrivacyPolicyProps) {
    return (
        <div className="flex flex-col h-full bg-background text-foreground">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background/80 backdrop-blur-md z-10">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Lock className="w-5 h-5 text-primary" />
                    Privacy Policy
                </h2>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Version 2.4 (2026 Compliance)</p>
                    <p className="text-sm leading-relaxed">
                        At Komorembi, your privacy is our priority. This policy outlines how we handle your data to provide a safe and meaningful experience.
                    </p>
                </div>

                {/* Section 1 */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-primary">
                        <Eye className="w-5 h-5" />
                        <h3 className="font-bold text-lg">1. Data We Collect</h3>
                    </div>
                    <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                        <div>
                            <p className="font-semibold text-foreground mb-1">Profile Data:</p>
                            <p>Display name, birth date (for age verification), and your uploaded profile photos.</p>
                        </div>
                        <div>
                            <p className="font-semibold text-foreground mb-1">Interaction Data:</p>
                            <p>We store conversations, reports, blocks, moderation events, notification preferences, and feed settings needed to run the service safely.</p>
                        </div>
                        <div>
                            <p className="font-semibold text-foreground mb-1">Location Data:</p>
                            <p>You choose your city and state manually. We do not collect or store GPS coordinates in the MVP.</p>
                        </div>
                        <div>
                            <p className="font-semibold text-foreground mb-1">Messages:</p>
                            <p>Messages are moderated before delivery. Blocked messages are kept temporarily for safety review and then deleted according to our retention policy.</p>
                        </div>
                    </div>
                </section>

                {/* Section 2 */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-primary">
                        <HeartHandshake className="w-5 h-5" />
                        <h3 className="font-bold text-lg">2. How We Protect Women & Vulnerable Users</h3>
                    </div>
                    <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                        <p>
                            <span className="font-semibold text-foreground">Safety Filtering:</span> Discovery excludes banned, blocked, reported, incomplete, inactive, hidden, and waitlisted accounts where required by the MVP rules.
                        </p>
                        <p>
                            <span className="font-semibold text-foreground">Data Minimization:</span> Waitlisted previews are redacted on the server, and only processed profile photos and thumbnails are stored.
                        </p>
                    </div>
                </section>

                {/* Section 3 */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-primary">
                        <UserCheck className="w-5 h-5" />
                        <h3 className="font-bold text-lg">3. Your Rights & Data Control</h3>
                    </div>
                    <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                        <p>
                            <span className="font-semibold text-foreground">Right to Erasure:</span> You can delete your profile at any time. Your profile is hidden immediately and final purge is scheduled after the 14-day grace period.
                        </p>
                        <p>
                            <span className="font-semibold text-foreground">Export Requests:</span> You can request a copy of the account data Komorembi stores about you from settings.
                        </p>
                    </div>
                </section>

                <div className="pt-6 border-t border-border">
                    <div className="flex items-start gap-3 p-4 bg-muted rounded-2xl">
                        <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Your trust is built on transparency. We never sell your personal data to third-party advertisers.
                        </p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border bg-background/80 backdrop-blur-md sticky bottom-0">
                <button
                    onClick={onClose}
                    className="w-full py-4 bg-foreground text-background rounded-full font-bold transition-transform active:scale-95"
                >
                    I Consent
                </button>
            </div>
        </div>
    );
}
