import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "TechnoSurg 2026 | AI, Robotics & Fluorescence in Surgery",
  description: "India's premier surgical technology summit. 500+ surgeons, 50+ expert faculty, 30+ live surgeries. June 19-20, 2026 at ITC Grand Chola, Chennai. Register now.",
  keywords: ["TechnoSurg", "surgical conference", "robotic surgery", "AI surgery", "fluorescence imaging", "ICG surgery", "GEM Hospital", "Chennai", "2026"],
  openGraph: {
    title: "TechnoSurg 2026 | AI, Robotics & Fluorescence in Surgery",
    description: "India's premier surgical technology summit. 500+ surgeons, 50+ expert faculty, 30+ live surgeries. June 19-20, 2026 at ITC Grand Chola, Chennai.",
    type: "website",
    url: "https://technosurg.gemhospitals.com",
    siteName: "TechnoSurg 2026",
    images: [
      {
        url: "/landing/hero-poster.jpg",
        width: 1200,
        height: 630,
        alt: "TechnoSurg 2026 - AI, Robotics & Fluorescence in Surgery",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TechnoSurg 2026 | AI, Robotics & Fluorescence in Surgery",
    description: "India's premier surgical technology summit. June 19-20, 2026 at ITC Grand Chola, Chennai.",
    images: ["/landing/hero-poster.jpg"],
  },
}

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return children
}
