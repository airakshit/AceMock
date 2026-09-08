import "./globals.css";
import "katex/dist/katex.min.css";
import { Toaster } from "sonner";
import { Plus_Jakarta_Sans } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { TooltipProvider } from "@/components/ui/tooltip";

const displayFont = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${displayFont.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href="/favicon/favicon.ico" sizes="any" />
      </head>
      <body className="font-sans antialiased">
        <Toaster position="top-right" richColors closeButton />
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
