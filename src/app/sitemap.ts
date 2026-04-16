import type { MetadataRoute } from "next"
import { FEATURES } from "@/lib/config"

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
    "https://technosurg.gemhospitals.com"
  ).replace(/\/$/, "")

  const now = new Date()

  const entries: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/register`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/help`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ]

  if (FEATURES.membership) {
    entries.push({
      url: `${baseUrl}/membership/apply`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    })
  }

  return entries
}
