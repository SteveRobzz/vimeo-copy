import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Video Platform",
  description: "Upload, transcode, and stream video.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
}
