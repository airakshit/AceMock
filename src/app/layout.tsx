import "./globals.css";

import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

const themeInitScript = `
(function () {
  try {
    var theme = localStorage.getItem("theme-preference");
    var root = document.documentElement;
    function setTheme(value) {
      var useDark = value === "dark" || (value !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", useDark);
    }

    if (theme === "light" || theme === "dark" || theme === "system") {
      setTheme(theme);
    } else {
      setTheme("system");
    }

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      if (!localStorage.getItem("theme-preference") || localStorage.getItem("theme-preference") === "system") {
        setTheme("system");
      }
    });
  } catch (error) {
    /* ignore */
  }
})();
`;

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
                {children}
            </body>
        </html>
    );
}
