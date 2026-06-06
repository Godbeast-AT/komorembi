import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Komorembi",
    description: "Intentional dating with safer profiles, first-message conversations, and thoughtful meet prompts.",
};

export const viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="font-sans">
                {children}
            </body>
        </html>
    );
}
