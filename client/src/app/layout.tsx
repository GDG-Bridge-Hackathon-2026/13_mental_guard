import type { Metadata } from "next";
import "./globals.css";
import { LoadingOverlay } from "@/components/LoadingOverlay";

export const metadata: Metadata = {
  title: "Mental Guard AI",
  description: "Convey the essence of complaints, reduce the harm of verbal abuse.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans bg-canvas text-ink">
        {children}
        <LoadingOverlay />
      </body>
    </html>
  );
}
