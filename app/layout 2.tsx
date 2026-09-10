import type { Metadata } from "next";
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
        <MetaPixel />
        {children}
      </body>
    </html>
  );
}
