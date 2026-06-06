import React, { useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    // Apply theme class to html element
    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }, [theme]);

    return (
        <button
            onClick={toggleTheme}
            className="flex items-center gap-2 p-2 rounded-full hover:bg-muted transition"
            aria-label="Toggle Theme"
        >
            {theme === 'dark' ? (
                <Moon className="w-5 h-5 text-foreground" />
            ) : (
                <Sun className="w-5 h-5 text-yellow-500" />
            )}
            <span className="text-foreground capitalize">{theme}</span>
        </button>
    );
}
