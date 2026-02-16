"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  User,
  Phone,
  MapPin,
  GraduationCap,
  Stethoscope,
  Loader2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

const MEMBERSHIP_TYPES = [
  { value: "Life Member [LM]", label: "Life Member [LM]" },
  { value: "Associate Life Member [ALM]", label: "Associate Life Member [ALM]" },
  { value: "International Life Member [ILM]", label: "International Life Member [ILM]" },
  { value: "Associate Candidate Member [ACM]", label: "Associate Candidate Member [ACM]" },
]

const GENDER_OPTIONS = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Other", label: "Other" },
]

const STEPS = [
  { id: 1, title: "Personal Info", icon: User },
  { id: 2, title: "Contact", icon: Phone },
  { id: 3, title: "Address", icon: MapPin },
  { id: 4, title: "Education", icon: GraduationCap },
  { id: 5, title: "Professional", icon: Stethoscope },
]

export default function MembershipApplyPage() {
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [applicationNumber, setApplicationNumber] = useState("")
  const [error, setError] = useState("")
  const [formData, setFormData] = useState<Record<string, string>>({
    name: "",
    father_name: "",
    date_of_birth: "",
    nationality: "Indian",
    gender: "",
    membership_type: "",
    email: "",
    phone: "",
    mobile_code: "+91",
    landline: "",
    std_code: "",
    street_address_1: "",
    street_address_2: "",
    city: "",
    state: "",
    country: "India",
    postal_code: "",
    ug_college: "",
    ug_university: "",
    ug_year: "",
    pg_degree: "",
    pg_college: "",
    pg_university: "",
    pg_year: "",
    mci_council_number: "",
    mci_council_state: "",
    imr_registration_no: "",
    asi_membership_no: "",
    asi_state: "",
    other_intl_org: "",
    other_intl_org_value: "",
  })

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const validateStep = (): string | null => {
    if (step === 1) {
      if (!formData.name.trim()) return "Full name is required"
      if (!formData.membership_type) return "Please select a membership type"
    }
    if (step === 2) {
      if (!formData.email.trim()) return "Email is required"
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return "Please enter a valid email"
      if (!formData.phone.trim()) return "Mobile number is required"
    }
    return null
  }

  const handleNext = () => {
    const validationError = validateStep()
    if (validationError) {
      setError(validationError)
      return
    }
    setError("")
    setStep(s => Math.min(s + 1, 5))
  }

  const handleBack = () => {
    setError("")
    setStep(s => Math.max(s - 1, 1))
  }

  const handleSubmit = async () => {
    const validationError = validateStep()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      const response = await fetch("/api/membership/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || "Failed to submit application")
        return
      }

      setApplicationNumber(result.application_number)
      setSubmitted(true)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Application Submitted</h2>
            <p className="text-muted-foreground">
              Your membership application has been submitted successfully and is under review.
            </p>
            <div className="bg-secondary/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Application Number</p>
              <p className="text-xl font-bold font-mono text-primary">{applicationNumber}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Please save this application number for your records. You will receive an email once your application is reviewed.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-lg font-bold text-white">A</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">AMASI Membership Application</h1>
              <p className="text-sm text-muted-foreground">Association of Minimal Access Surgeons of India</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center transition-all",
                    step === s.id
                      ? "bg-primary text-white"
                      : step > s.id
                      ? "bg-green-100 text-green-600"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  {step > s.id ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <s.icon className="h-5 w-5" />
                  )}
                </div>
                <span className={cn(
                  "text-xs mt-1.5 hidden sm:block",
                  step === s.id ? "text-primary font-medium" : "text-muted-foreground"
                )}>
                  {s.title}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn(
                  "flex-1 h-0.5 mx-2",
                  step > s.id ? "bg-green-200" : "bg-border"
                )} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card>
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Enter your personal details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name *</Label>
                    <Input
                      placeholder="Enter your full name"
                      value={formData.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Father&apos;s Name</Label>
                    <Input
                      placeholder="Enter father's name"
                      value={formData.father_name}
                      onChange={(e) => handleChange("father_name", e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date of Birth</Label>
                    <Input
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => handleChange("date_of_birth", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select
                      value={formData.gender || undefined}
                      onValueChange={(v) => handleChange("gender", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDER_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nationality</Label>
                    <Input
                      value={formData.nationality}
                      onChange={(e) => handleChange("nationality", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Membership Type *</Label>
                    <Select
                      value={formData.membership_type || undefined}
                      onValueChange={(v) => handleChange("membership_type", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {MEMBERSHIP_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>How can we reach you?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Email Address *</Label>
                  <Input
                    type="email"
                    placeholder="your.email@example.com"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mobile Number *</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.mobile_code}
                      onChange={(e) => handleChange("mobile_code", e.target.value)}
                      placeholder="+91"
                      className="w-20"
                    />
                    <Input
                      type="tel"
                      placeholder="9876543210"
                      value={formData.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      className="flex-1"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Landline (Optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.std_code}
                      onChange={(e) => handleChange("std_code", e.target.value)}
                      placeholder="STD"
                      className="w-20"
                    />
                    <Input
                      value={formData.landline}
                      onChange={(e) => handleChange("landline", e.target.value)}
                      placeholder="Landline number"
                      className="flex-1"
                    />
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {step === 3 && (
            <>
              <CardHeader>
                <CardTitle>Address</CardTitle>
                <CardDescription>Your correspondence address</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Street Address 1</Label>
                  <Input
                    placeholder="House/Flat no, Building name"
                    value={formData.street_address_1}
                    onChange={(e) => handleChange("street_address_1", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Street Address 2</Label>
                  <Input
                    placeholder="Area, Landmark"
                    value={formData.street_address_2}
                    onChange={(e) => handleChange("street_address_2", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input value={formData.city} onChange={(e) => handleChange("city", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input value={formData.state} onChange={(e) => handleChange("state", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input value={formData.country} onChange={(e) => handleChange("country", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Postal/Zip Code</Label>
                    <Input value={formData.postal_code} onChange={(e) => handleChange("postal_code", e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {step === 4 && (
            <>
              <CardHeader>
                <CardTitle>Education</CardTitle>
                <CardDescription>Your academic qualifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-3">Undergraduate</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>College</Label>
                      <Input value={formData.ug_college} onChange={(e) => handleChange("ug_college", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>University</Label>
                      <Input value={formData.ug_university} onChange={(e) => handleChange("ug_university", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Year</Label>
                      <Input value={formData.ug_year} onChange={(e) => handleChange("ug_year", e.target.value)} placeholder="e.g., 2018" />
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-3">Postgraduate</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Degree</Label>
                      <Input value={formData.pg_degree} onChange={(e) => handleChange("pg_degree", e.target.value)} placeholder="e.g., MS, MCh" />
                    </div>
                    <div className="space-y-2">
                      <Label>College</Label>
                      <Input value={formData.pg_college} onChange={(e) => handleChange("pg_college", e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label>University</Label>
                      <Input value={formData.pg_university} onChange={(e) => handleChange("pg_university", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Year</Label>
                      <Input value={formData.pg_year} onChange={(e) => handleChange("pg_year", e.target.value)} placeholder="e.g., 2022" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {step === 5 && (
            <>
              <CardHeader>
                <CardTitle>Professional / Medical Council</CardTitle>
                <CardDescription>Your professional registrations and memberships</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>MCI/NMC Council Number</Label>
                    <Input value={formData.mci_council_number} onChange={(e) => handleChange("mci_council_number", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Council State</Label>
                    <Input value={formData.mci_council_state} onChange={(e) => handleChange("mci_council_state", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>IMR Registration No</Label>
                  <Input value={formData.imr_registration_no} onChange={(e) => handleChange("imr_registration_no", e.target.value)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ASI Membership No</Label>
                    <Input value={formData.asi_membership_no} onChange={(e) => handleChange("asi_membership_no", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>ASI State</Label>
                    <Input value={formData.asi_state} onChange={(e) => handleChange("asi_state", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Other International Organization</Label>
                    <Input value={formData.other_intl_org} onChange={(e) => handleChange("other_intl_org", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Organization Membership ID</Label>
                    <Input value={formData.other_intl_org_value} onChange={(e) => handleChange("other_intl_org_value", e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </>
          )}
        </Card>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          {step < 5 ? (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Application"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
