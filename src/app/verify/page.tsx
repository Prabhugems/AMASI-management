"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Shield, Search, FileText, Award } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function VerifyPage() {
  const router = useRouter()
  const [abstractNumber, setAbstractNumber] = useState("")

  const handleVerify = () => {
    if (abstractNumber.trim()) {
      router.push(`/verify/abstract/${abstractNumber.trim()}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Shield className="h-4 w-4" />
            <span>Certificate Verification Portal</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Award className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-3">
            Verify Certificate
          </h1>
          <p className="text-slate-500 max-w-md mx-auto">
            Enter the abstract number from the certificate to verify its authenticity.
          </p>
        </div>

        {/* Search Card */}
        <div className="bg-white rounded-2xl border shadow-sm p-6 mb-8">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-4">
            <Search className="h-4 w-4" />
            <span>Enter Abstract Number</span>
          </div>

          <div className="flex gap-3">
            <div className="relative flex-1">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                value={abstractNumber}
                onChange={(e) => setAbstractNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                placeholder="e.g., ABS-001 or 2024-0042"
                className="pl-10 h-12 text-lg"
              />
            </div>
            <Button
              onClick={handleVerify}
              disabled={!abstractNumber.trim()}
              className="h-12 px-6 bg-indigo-600 hover:bg-indigo-700"
            >
              Verify
            </Button>
          </div>

          <p className="text-xs text-slate-400 mt-3">
            The abstract number can be found on the certificate, usually near the QR code.
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bg-white rounded-xl border p-5">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mb-3">
              <Shield className="h-5 w-5 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-slate-800 mb-1">Authentic Verification</h3>
            <p className="text-sm text-slate-500">
              Verify that a presenter certificate is genuine and issued by the conference.
            </p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-800 mb-1">Paper Details</h3>
            <p className="text-sm text-slate-500">
              View the presenter name, paper title, and presentation details.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t bg-white mt-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 text-center">
          <p className="text-xs text-slate-400">
            This is an official certificate verification portal.
          </p>
        </div>
      </div>
    </div>
  )
}
