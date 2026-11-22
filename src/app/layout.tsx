import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Зал ва хоналарни бронлаш", template: "%s · Ўқув маркази" },
  description: "Иқтисодиёт ва молия вазирлиги ҳузуридаги Ўқув маркази зал ва хоналарини бронлаш тизими",
};

export const viewport: Viewport = {
  themeColor: "#0b3d6b",
  width: "device-width",
  initialScale: 1,
};

// Мавзу ва шрифт созламаларини саҳифа чизилишидан олдин қўллаш (липиллашсиз)
const prefsScript = `try{var p=JSON.parse(localStorage.getItem('a11y')||'{}');var d=document.documentElement;if(p.size)d.style.setProperty('--base-size',p.size+'px');if(p.gray)d.classList.add('grayscale-mode');if(p.dark===true||(p.dark===undefined&&matchMedia('(prefers-color-scheme: dark)').matches))d.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz-Cyrl" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: prefsScript }} />
      </head>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
