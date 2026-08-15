import "./globals.css";
import { Toaster } from "sonner";
import { Lobster } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { TooltipProvider } from "@/components/ui/tooltip";

const caveat = Lobster({
    variable: "--font-caveat",
    subsets: ["latin"],
    weight: ["400"],
});

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            suppressHydrationWarning
            className={`${GeistSans.variable} ${GeistMono.variable} ${caveat.variable}`}
        >
            <head>
                <link rel="icon" href="/favicon/favicon.ico" sizes="any" />
            </head>
            <body className="font-sans antialiased">
                <Toaster position="top-right" />
                <TooltipProvider>{children}</TooltipProvider>
            </body>
        </html>
    );
}
