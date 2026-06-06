import React from 'react';
import { Menu } from 'lucide-react';

interface SettingsButtonProps {
    onClick: () => void;
}

export default function SettingsButton({ onClick }: SettingsButtonProps) {
    return (
        <button
            onClick={onClick}
            className="p-2 rounded-full hover:bg-white/10 transition"
            aria-label="Open Settings"
        >
            <Menu className="w-6 h-6 text-white" />
        </button>
    );
}
