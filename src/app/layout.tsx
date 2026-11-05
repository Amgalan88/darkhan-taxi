import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: "Дархан Такси",
  description: "Дарханы такси дуудлага",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Дархан Такси", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0B2545",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn">
      <body className={inter.className} style={{ maxWidth: 480, margin: "0 auto", minHeight: "100dvh", position: "relative", background: "#F4F6F9" }}>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))}`,
          }}
        />
      </body>
    </html>
  );
}
