import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../lib/authContext";

export const metadata: Metadata = {
  title: "GridGuesser - Real-time Image Guessing Game",
  description: "A multiplayer game where you reveal tiles and guess images against your opponent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

