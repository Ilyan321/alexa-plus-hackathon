import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EchoForge — Industrial Voice Assistant",
  description: "Real-time edge metrology and aerospace voice bridge",
  icons: {
    icon: [
      { url: "/echoforge-favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    apple: "/echoforge-favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-brand-50 text-brand-900 selection:bg-brand-300 selection:text-white">
        {children}
      </body>
    </html>
  );
}


