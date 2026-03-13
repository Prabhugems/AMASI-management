import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Submit Abstract",
  description: "Submit your abstract for the conference",
}

export default function SubmitAbstractLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {children}
    </div>
  )
}
