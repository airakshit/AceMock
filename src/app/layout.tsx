import "./globals.css";
import { Toaster } from "sonner";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { themeInitScript } from "@/lib/theme";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <link rel="icon" href="/favicon/favicon.ico" sizes="any" />
            </head>
            <body
                className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
            >
                <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
                <Toaster position="top-right"/>
                {children}
            </body>
        </html>
    );
}
