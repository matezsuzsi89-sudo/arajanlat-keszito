import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Árajánlat generátor",
  description: "Általános árajánlat készítő",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hu">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
