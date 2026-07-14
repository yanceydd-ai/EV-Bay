import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EV Bay",
  description: "EV charging bay availability monitoring and notifications"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

