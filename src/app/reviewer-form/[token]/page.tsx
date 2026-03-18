"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CheckCircle, AlertCircle, User } from "lucide-react"
import { COMPANY_CONFIG } from "@/lib/config"

type ReviewerData = {
  id: string
  name: string
  email: string
  phone: string | null
  institution: string | null
  city: string | null
  specialty: string | null
  years_of_experience: string | null
  form_completed_at: string | null
}

export default function ReviewerFormPage() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [reviewer, setReviewer] = useState<ReviewerData | null>(null)

  const [form, setForm] = useState({
    phone: "",
    institution: "",
    city: "",
    specialty: "",
    years_of_experience: "",
  })

  // Load reviewer data
  useEffect(() => {
    const fetchReviewer = async () => {
      try {
        const res = await fetch(`/api/reviewer-form?token=${token}`)
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || "Failed to load")
        }
        const data = await res.json()
        setReviewer(data)
        setForm({
          phone: data.phone || "",
          institution: data.institution || "",
          city: data.city || "",
          specialty: data.specialty || "",
          years_of_experience: data.years_of_experience || "",
        })
      } catch (err: any) {
        setError(err.message || "Invalid or expired link")
      } finally {
        setLoading(false)
      }
    }
    fetchReviewer()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.specialty.trim()) {
      setError("Please enter your specialty/areas of interest")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/reviewer-form", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...form }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to save")
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error && !reviewer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Link Not Valid</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (reviewer?.form_completed_at || success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <CardTitle>Thank You!</CardTitle>
            <CardDescription>
              Your details have been saved successfully. We will be in touch regarding upcoming review assignments.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{COMPANY_CONFIG.name}</h1>
          <p className="text-sm text-gray-600">{COMPANY_CONFIG.fullName}</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{reviewer?.name}</CardTitle>
                <CardDescription>{reviewer?.email}</CardDescription>
              </div>
            </div>
            <CardDescription className="mt-4">
              Thank you for agreeing to be a reviewer. Please fill in your details below to help us match you with relevant abstracts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="9876543210"
                />
              </div>

              <div>
                <Label htmlFor="institution">Institution / Hospital</Label>
                <Input
                  id="institution"
                  value={form.institution}
                  onChange={(e) => setForm({ ...form, institution: e.target.value })}
                  placeholder="Apollo Hospital, Chennai"
                />
              </div>

              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Chennai"
                />
              </div>

              <div>
                <Label htmlFor="years">Years of Experience</Label>
                <Input
                  id="years"
                  value={form.years_of_experience}
                  onChange={(e) => setForm({ ...form, years_of_experience: e.target.value })}
                  placeholder="10"
                />
              </div>

              <div>
                <Label htmlFor="specialty">
                  Specialty / Areas of Interest <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="specialty"
                  value={form.specialty}
                  onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                  placeholder="e.g., General Surgery, Hernia Surgery, Bariatric Surgery, Colorectal Surgery"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter your areas of expertise to help us assign relevant abstracts for review.
                </p>
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Submit Details"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-500 mt-6">
          If you have any questions, please contact the {COMPANY_CONFIG.name} team.
        </p>
      </div>
    </div>
  )
}
