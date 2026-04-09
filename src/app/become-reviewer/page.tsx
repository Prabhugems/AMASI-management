"use client"

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, CheckCircle2, ClipboardCheck, Award } from "lucide-react"
import { toast } from "sonner"
import { COMPANY_CONFIG } from "@/lib/config"

const SPECIALTIES = [
  "General & GI Surgery",
  "Bariatric & Metabolic Surgery",
  "Hepatobiliary & Pancreatic Surgery",
  "Colorectal Surgery",
  "Hernia Surgery",
  "Esophageal Surgery",
  "Upper GI Surgery",
  "Thoracic Surgery (VATS thoracoscopy)",
  "Pediatric Minimal Access Surgery",
  "Urological Minimal Access Surgery",
  "Gynecological Minimal Access Surgery",
  "Surgical Oncology (Minimally invasive)",
  "Endoscopy (Diagnostic & Therapeutic)",
  "Robotic Surgery",
  "Single Incision Laparoscopic Surgery (SILS)",
  "Endoscopic Bariatric Procedures",
]

const YEARS_OPTIONS = [
  "Less than 5",
  "5-10",
  "10-15",
  "15-20",
  "20-25",
  "25-30",
  "30+",
]

type Event = {
  id: string
  name: string
  short_name: string
}

export default function BecomeReviewerPage() {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    institution: "",
    city: "",
    availability: "Yes",
    specialties: [] as string[],
    otherSpecialty: "",
    yearsOfExperience: "",
    previousReviewExperience: "",
    comments: "",
    eventId: "",
  })

  // Fetch events that have abstract submissions enabled
  const { data: events = [] } = useQuery({
    queryKey: ["public-events-for-reviewer"],
    queryFn: async () => {
      const res = await fetch("/api/events?status=registration_open,ongoing,planning")
      if (!res.ok) return []
      const data = await res.json()
      return (data.events || data || []) as Event[]
    },
  })

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!form.eventId) throw new Error("Please select an event")
      if (!form.name.trim()) throw new Error("Name is required")
      if (!form.email.trim()) throw new Error("Email is required")

      // Combine specialties
      const allSpecialties = [...form.specialties]
      if (form.otherSpecialty.trim()) {
        allSpecialties.push(form.otherSpecialty.trim())
      }

      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        institution: form.institution.trim() || null,
        city: form.city.trim() || null,
        specialty: allSpecialties.join(", ") || null,
        years_of_experience: form.yearsOfExperience || null,
        status: form.availability === "Yes" ? "active" : form.availability === "Maybe" ? "active" : "inactive",
        notes: [
          form.previousReviewExperience ? `Previous Review Experience: ${form.previousReviewExperience}` : "",
          form.comments ? `Comments: ${form.comments}` : "",
          `Availability: ${form.availability}`,
        ].filter(Boolean).join("\n") || null,
      }

      const res = await fetch(`/api/abstract-reviewers/${form.eventId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Registration failed")
      }

      return res.json()
    },
    onSuccess: () => {
      setSubmitted(true)
      toast.success("Registration submitted successfully!")
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const toggleSpecialty = (specialty: string) => {
    setForm(prev => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter(s => s !== specialty)
        : [...prev.specialties, specialty]
    }))
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Thank You!</h1>
          <p className="text-muted-foreground mb-6">
            Your reviewer registration has been submitted successfully. We will contact you with further details.
          </p>
          <Button onClick={() => {
            setSubmitted(false)
            setForm({
              name: "", email: "", phone: "", institution: "", city: "",
              availability: "Yes", specialties: [], otherSpecialty: "",
              yearsOfExperience: "", previousReviewExperience: "", comments: "", eventId: "",
            })
          }}>
            Register Another
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Award className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Become a Reviewer</h1>
          <p className="text-muted-foreground">
            Register to review abstracts and videos for {COMPANY_CONFIG.name} events
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 space-y-6">
          {/* Event Selection */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Select Event *</Label>
            <Select value={form.eventId} onValueChange={(v) => setForm({ ...form, eventId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an event to review for..." />
              </SelectTrigger>
              <SelectContent>
                {events.map(event => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Personal Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Personal Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Dr. John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label>Email Address *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Mumbai"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Institution / Hospital</Label>
              <Input
                value={form.institution}
                onChange={(e) => setForm({ ...form, institution: e.target.value })}
                placeholder="AIIMS, New Delhi"
              />
            </div>
          </div>

          {/* Availability */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Availability Status *</Label>
            <Select value={form.availability} onValueChange={(v) => setForm({ ...form, availability: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes - Available to review</SelectItem>
                <SelectItem value="Maybe">Maybe - Depends on timing</SelectItem>
                <SelectItem value="No">No - Not available currently</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Specialty Interests */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Specialty Interests</Label>
            <p className="text-sm text-muted-foreground">Select all areas you can review</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SPECIALTIES.map((specialty) => (
                <div key={specialty} className="flex items-center space-x-2">
                  <Checkbox
                    id={specialty}
                    checked={form.specialties.includes(specialty)}
                    onCheckedChange={() => toggleSpecialty(specialty)}
                  />
                  <label
                    htmlFor={specialty}
                    className="text-sm cursor-pointer leading-tight"
                  >
                    {specialty}
                  </label>
                </div>
              ))}
            </div>
            <div className="space-y-2 pt-2">
              <Label>Other Specialty (if not listed above)</Label>
              <Input
                value={form.otherSpecialty}
                onChange={(e) => setForm({ ...form, otherSpecialty: e.target.value })}
                placeholder="Enter other specialty..."
              />
            </div>
          </div>

          {/* Experience */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Experience</h3>

            <div className="space-y-2">
              <Label>Years of Experience</Label>
              <Select value={form.yearsOfExperience} onValueChange={(v) => setForm({ ...form, yearsOfExperience: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select years of experience..." />
                </SelectTrigger>
                <SelectContent>
                  {YEARS_OPTIONS.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt} years</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Previous Review Experience</Label>
              <Textarea
                value={form.previousReviewExperience}
                onChange={(e) => setForm({ ...form, previousReviewExperience: e.target.value })}
                placeholder="Describe any previous experience reviewing abstracts, papers, or videos..."
                rows={3}
              />
            </div>
          </div>

          {/* Additional Comments */}
          <div className="space-y-2">
            <Label>Additional Comments / Queries</Label>
            <Textarea
              value={form.comments}
              onChange={(e) => setForm({ ...form, comments: e.target.value })}
              placeholder="Any questions or additional information..."
              rows={3}
            />
          </div>

          {/* Submit */}
          <Button
            className="w-full h-12 text-lg"
            onClick={() => submitMutation.mutate()}
            disabled={!form.name || !form.email || !form.eventId || submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <ClipboardCheck className="h-5 w-5 mr-2" />
                Submit Registration
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By submitting, you agree to review abstracts/videos assigned to you in a timely manner.
          </p>
        </div>
      </div>
    </div>
  )
}
