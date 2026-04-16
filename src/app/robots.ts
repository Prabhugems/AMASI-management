import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
    "https://technosurg.gemhospitals.com"
  ).replace(/\/$/, "")

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/login",
          "/team-login",
          "/travel-login",
          "/team-portal",
          "/team-invite",
          "/team/accept-invite",
          "/auth/",
          "/events/",
          "/faculty/",
          "/members/",
          "/forms/",
          "/delegates",
          "/reviewers",
          "/team",
          "/transport",
          "/transport-portal",
          "/driver-portal",
          "/travel-dashboard",
          "/audit",
          "/my",
          "/speaker/",
          "/speaker-portal/",
          "/respond/",
          "/check-in/",
          "/checkin/",
          "/travel-agent/",
          "/cab-agent/",
          "/flight-agent/",
          "/train-agent/",
          "/print-agent/",
          "/print-certificate/",
          "/print-station",
          "/print/",
          "/badge/",
          "/judge/",
          "/examiner/",
          "/abstract-reviewer/",
          "/reviewer-portal/",
          "/reviewer-form/",
          "/presenter-checkin/",
          "/hall-coordinator/",
          "/upload-presentation/",
          "/kiosk/",
          "/verify/",
          "/v/",
          "/f/",
          "/status",
          "/offline",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
