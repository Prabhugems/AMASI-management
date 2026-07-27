import type { Metadata } from "next"
import { getTenant } from "@/lib/tenant"

const technosurgMetadata: Metadata = {
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

const tamilconMetadata: Metadata = {
  title: "TAMILCON 2026 | 4th TNOA Tamil Orthopaedic Conference",
  description: "State-level Tamil Orthopaedic Conference, hosted by Coimbatore Orthopaedic Society. 3-4 October 2026 at Hotel Merlis, Coimbatore. Register now.",
  keywords: ["TAMILCON", "TNOA", "Tamil Orthopaedic Conference", "Coimbatore Orthopaedic Society", "orthopaedic conference", "Coimbatore", "2026"],
  openGraph: {
    title: "TAMILCON 2026 | 4th TNOA Tamil Orthopaedic Conference",
    description: "State-level Tamil Orthopaedic Conference, hosted by Coimbatore Orthopaedic Society. 3-4 October 2026 at Hotel Merlis, Coimbatore.",
    type: "website",
    siteName: "TAMILCON 2026",
    images: [
      {
        url: "/landing/tamilcon-audience.jpg",
        width: 800,
        height: 565,
        alt: "TAMILCON 2026 - 4th TNOA Tamil Orthopaedic Conference",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TAMILCON 2026 | 4th TNOA Tamil Orthopaedic Conference",
    description: "3-4 October 2026 at Hotel Merlis, Coimbatore.",
    images: ["/landing/tamilcon-audience.jpg"],
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return getTenant() === "cos" ? tamilconMetadata : technosurgMetadata
}

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return children
}
