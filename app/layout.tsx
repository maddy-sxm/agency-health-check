import type { Metadata } from "next";
import GoogleTag from "@/components/GoogleTag";
import LinkedInInsight from "@/components/LinkedInInsight";
import MetaPixel from "@/components/MetaPixel";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agency Health Check | SPEEDXMEDIA",
  description:
    "See how your current agency performs across communication, strategic leadership, accountability, and long-term partnership health.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Base tracking tags — one instance each, on every page. */}
        <GoogleTag />
        <MetaPixel />
        <LinkedInInsight />
        {children}
      </body>
    </html>
  );
}
