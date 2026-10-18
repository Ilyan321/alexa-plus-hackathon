import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EchoForge — Industrial Voice Assistant & Edge Metrology AI",
  description: "Autonomous hands-free voice AI bridge connecting Alexa+ and AWS Bedrock AgentCore to legacy CMM factory inspection data via Model Context Protocol (MCP 2025-11-25).",
  keywords: [
    "EchoForge",
    "Alexa+",
    "AWS Bedrock",
    "AgentCore",
    "Amazon Nova Pro",
    "Model Context Protocol",
    "MCP",
    "Metrology",
    "Aerospace Manufacturing",
    "Cleanroom Voice AI",
    "CMM",
    "DMO"
  ],
  authors: [{ name: "EchoForge Team" }],
  creator: "EchoForge",
  publisher: "EchoForge",
  metadataBase: new URL("https://echoforge.aenox.me"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "EchoForge — Industrial Voice Assistant & Edge Metrology AI",
    description: "Hands-free ambient voice intelligence for aerospace cleanrooms powered by AWS Bedrock AgentCore & Model Context Protocol.",
    url: "https://echoforge.aenox.me",
    siteName: "EchoForge",
    images: [
      {
        url: "/echoforge-logo.jpg",
        width: 1024,
        height: 1024,
        alt: "EchoForge - Industrial Voice-to-Edge Bridge Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "EchoForge — Industrial Voice Assistant",
    description: "Hands-free ambient voice intelligence for aerospace cleanrooms powered by AWS Bedrock AgentCore & MCP.",
    images: ["/echoforge-logo.jpg"],
  },
  icons: {
    icon: [
      { url: "/echoforge-favicon.svg", type: "image/svg+xml" },
      { url: "/echoforge-favicon.png", type: "image/png" },
    ],
    shortcut: "/echoforge-favicon.svg",
    apple: "/echoforge-favicon.png",
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


