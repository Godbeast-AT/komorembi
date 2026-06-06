"use client";

import React from 'react';
import { X, Shield, Users, Coins, Info } from 'lucide-react';

interface TermsOfServiceProps {
    onClose: () => void;
}

export default function TermsOfService({ onClose }: TermsOfServiceProps) {
    return (
        <div className="flex flex-col h-full bg-background text-foreground">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background/80 backdrop-blur-md z-10">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    Terms of Service
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
                    <p className="text-sm text-muted-foreground">Effective Date: March 9, 2026</p>
                    <p className="text-sm leading-relaxed">
                        Welcome to Komorembi. By using our application, you agree to these Terms of Service. Please read them carefully.
                    </p>
                </div>

                {/* Section 1 */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-primary">
                        <Users className="w-5 h-5" />
                        <h3 className="font-bold text-lg">1. Eligibility & Age Gate</h3>
                    </div>
                    <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                        <p>
                            <span className="font-semibold text-foreground">18+ Requirement:</span> Komorembi is strictly for users aged 18 and older. By checking the age verification box, you legally represent that you meet this requirement.
                        </p>
                        <p>
                            <span className="font-semibold text-foreground">Account Responsibility:</span> You are responsible for all activity on each device session tied to your verified phone login.
                        </p>
                    </div>
                </section>

                {/* Section 2 */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-primary">
                        <Shield className="w-5 h-5" />
                        <h3 className="font-bold text-lg">2. Community Code of Conduct</h3>
                    </div>
                    <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                        <p>
                            <span className="font-semibold text-foreground">Zero Tolerance:</span> Use of the platform for nudity, harassment, hate speech, or the broadcast of illegal content is strictly prohibited.
                        </p>
                        <p>
                            <span className="font-semibold text-foreground">Message Moderation:</span> Messages are reviewed before delivery for threats, explicit content, personal-information requests, hate, harassment, and spam. Repeated violations can restrict messaging or suspend the account.
                        </p>
                        <p>
                            <span className="font-semibold text-foreground">Identity Integrity:</span> You agree to use a real name and authentic photos. Use of Deepfakes or impersonation will result in an immediate permanent ban.
                        </p>
                    </div>
                </section>

                {/* Section 3 */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-primary">
                        <Coins className="w-5 h-5" />
                        <h3 className="font-bold text-lg">3. MVP Access Limits</h3>
                    </div>
                    <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                        <p>
                            <span className="font-semibold text-foreground">Message Limits:</span> Opening messages are capped daily and must follow the community guidelines.
                        </p>
                        <p>
                            <span className="font-semibold text-foreground">Waitlist:</span> Some cities may use a waitlist to keep the community balanced. Leaving the waitlist means returning at the end of the queue.
                        </p>
                        <p>
                            <span className="font-semibold text-foreground">No Payments:</span> The MVP does not include payment features or paid virtual currency.
                        </p>
                    </div>
                </section>

                <div className="pt-6 border-t border-border">
                    <div className="flex items-start gap-3 p-4 bg-muted rounded-2xl">
                        <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Questions about our Terms? Contact our support team directly through the safety settings in your profile.
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
                    I Understand
                </button>
            </div>
        </div>
    );
}
