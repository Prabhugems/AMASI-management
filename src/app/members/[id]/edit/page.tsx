"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ArrowLeft,
  IdCard,
  Loader2,
  Save,
  User,
  Mail,
  Phone,
  Vote,
  MapPin,
  GraduationCap,
  Stethoscope,
  Building,
} from "lucide-react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"

const MEMBERSHIP_TYPES = [
  { value: "Life Member [LM]", label: "Life Member [LM]" },
  { value: "Associate Life Member [ALM]", label: "Associate Life Member [ALM]" },
  { value: "International Life Member [ILM]", label: "International Life Member [ILM]" },
  { value: "Associate Candidate Member [ACM]", label: "Associate Candidate Member [ACM]" },
]

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "expired", label: "Expired" },
  { value: "pending", label: "Pending" },
]

const GENDER_OPTIONS = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Other", label: "Other" },
]

export default function EditMemberPage() {
  const params = useParams()
  const memberId = params.id as string

  const [formData, setFormData] = useState<Record<string, any>>({
    amasi_number: "",
    name: "",
    email: "",
    phone: "",
    membership_type: "",
    status: "",
    voting_eligible: false,
    father_name: "",
    date_of_birth: "",
    nationality: "",
    gender: "",
    application_no: "",
    application_date: "",
    mobile_code: "",
    landline: "",
    std_code: "",
    street_address_1: "",
    street_address_2: "",
    city: "",
    state: "",
    country: "",
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

  const supabase = createClient()
  const queryClient = useQueryClient()
  const router = useRouter()

  const { data: member, isLoading } = useQuery({
    queryKey: ["member", memberId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("members")
        .select("*")
        .eq("id", memberId)
        .maybeSingle()

      if (error) throw error
      return data
    },
    enabled: !!memberId,
  })

  useEffect(() => {
    if (member) {
      setFormData({
        amasi_number: member.amasi_number?.toString() || "",
        name: member.name || "",
        email: member.email || "",
        phone: member.phone?.toString() || "",
        membership_type: member.membership_type || "",
        status: member.status || "active",
        voting_eligible: member.voting_eligible || false,
        father_name: member.father_name || "",
        date_of_birth: member.date_of_birth || "",
        nationality: member.nationality || "",
        gender: member.gender || "",
        application_no: member.application_no || "",
        application_date: member.application_date || "",
        mobile_code: member.mobile_code || "",
        landline: member.landline || "",
        std_code: member.std_code || "",
        street_address_1: member.street_address_1 || "",
        street_address_2: member.street_address_2 || "",
        city: member.city || "",
        state: member.state || "",
        country: member.country || "",
        postal_code: member.postal_code || "",
        ug_college: member.ug_college || "",
        ug_university: member.ug_university || "",
        ug_year: member.ug_year || "",
        pg_degree: member.pg_degree || "",
        pg_college: member.pg_college || "",
        pg_university: member.pg_university || "",
        pg_year: member.pg_year || "",
        mci_council_number: member.mci_council_number || "",
        mci_council_state: member.mci_council_state || "",
        imr_registration_no: member.imr_registration_no || "",
        asi_membership_no: member.asi_membership_no || "",
        asi_state: member.asi_state || "",
        other_intl_org: member.other_intl_org || "",
        other_intl_org_value: member.other_intl_org_value || "",
      })
    }
  }, [member])

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value }
      if (field === "membership_type") {
        const isLifeMember = value === "Life Member [LM]"
        updated.voting_eligible = isLifeMember
      }
      return updated
    })
  }

  const updateMember = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("members")
        .update({
          amasi_number: formData.amasi_number ? parseInt(formData.amasi_number) : null,
          name: formData.name || null,
          email: formData.email || null,
          phone: formData.phone ? parseInt(formData.phone) : null,
          membership_type: formData.membership_type || null,
          status: formData.status || "active",
          voting_eligible: formData.voting_eligible,
          father_name: formData.father_name || null,
          date_of_birth: formData.date_of_birth || null,
          nationality: formData.nationality || null,
          gender: formData.gender || null,
          application_no: formData.application_no || null,
          application_date: formData.application_date || null,
          mobile_code: formData.mobile_code || null,
          landline: formData.landline || null,
          std_code: formData.std_code || null,
          street_address_1: formData.street_address_1 || null,
          street_address_2: formData.street_address_2 || null,
          city: formData.city || null,
          state: formData.state || null,
          country: formData.country || null,
          postal_code: formData.postal_code || null,
          ug_college: formData.ug_college || null,
          ug_university: formData.ug_university || null,
          ug_year: formData.ug_year || null,
          pg_degree: formData.pg_degree || null,
          pg_college: formData.pg_college || null,
          pg_university: formData.pg_university || null,
          pg_year: formData.pg_year || null,
          mci_council_number: formData.mci_council_number || null,
          mci_council_state: formData.mci_council_state || null,
          imr_registration_no: formData.imr_registration_no || null,
          asi_membership_no: formData.asi_membership_no || null,
          asi_state: formData.asi_state || null,
          other_intl_org: formData.other_intl_org || null,
          other_intl_org_value: formData.other_intl_org_value || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", memberId)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Member updated successfully")
      queryClient.invalidateQueries({ queryKey: ["members"] })
      queryClient.invalidateQueries({ queryKey: ["member", memberId] })
      router.push("/members")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMember.mutate()
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/members">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Members
            </Link>
          </Button>
          <div className="h-6 w-px bg-border" />
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <IdCard className="h-6 w-6" />
              Edit Member
            </h1>
            <p className="text-sm text-muted-foreground">
              AMASI #{member?.amasi_number} - {member?.name}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Personal Information */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amasi_number">AMASI Number</Label>
                  <Input
                    id="amasi_number"
                    type="number"
                    value={formData.amasi_number}
                    onChange={(e) => handleChange("amasi_number", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="father_name">Father&apos;s Name</Label>
                  <Input
                    id="father_name"
                    value={formData.father_name}
                    onChange={(e) => handleChange("father_name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Date of Birth</Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => handleChange("date_of_birth", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select
                    value={formData.gender || undefined}
                    onValueChange={(v) => handleChange("gender", v)}
                  >
                    <SelectTrigger id="gender">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationality">Nationality</Label>
                  <Input
                    id="nationality"
                    value={formData.nationality}
                    onChange={(e) => handleChange("nationality", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="application_no">Application No</Label>
                  <Input
                    id="application_no"
                    value={formData.application_no}
                    onChange={(e) => handleChange("application_no", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Phone className="h-5 w-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Mobile</Label>
                  <div className="flex gap-2">
                    <Input
                      id="mobile_code"
                      value={formData.mobile_code}
                      onChange={(e) => handleChange("mobile_code", e.target.value)}
                      placeholder="+91"
                      className="w-20"
                    />
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="landline">Landline</Label>
                  <div className="flex gap-2">
                    <Input
                      id="std_code"
                      value={formData.std_code}
                      onChange={(e) => handleChange("std_code", e.target.value)}
                      placeholder="STD"
                      className="w-20"
                    />
                    <Input
                      id="landline"
                      value={formData.landline}
                      onChange={(e) => handleChange("landline", e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Address */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5" />
                Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="street_address_1">Street Address 1</Label>
                <Input
                  id="street_address_1"
                  value={formData.street_address_1}
                  onChange={(e) => handleChange("street_address_1", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="street_address_2">Street Address 2</Label>
                <Input
                  id="street_address_2"
                  value={formData.street_address_2}
                  onChange={(e) => handleChange("street_address_2", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => handleChange("state", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => handleChange("country", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input
                    id="postal_code"
                    value={formData.postal_code}
                    onChange={(e) => handleChange("postal_code", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Education */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <GraduationCap className="h-5 w-5" />
                Education
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3">Undergraduate</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ug_college">College</Label>
                    <Input id="ug_college" value={formData.ug_college} onChange={(e) => handleChange("ug_college", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ug_university">University</Label>
                    <Input id="ug_university" value={formData.ug_university} onChange={(e) => handleChange("ug_university", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ug_year">Year</Label>
                    <Input id="ug_year" value={formData.ug_year} onChange={(e) => handleChange("ug_year", e.target.value)} />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3">Postgraduate</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pg_degree">Degree</Label>
                    <Input id="pg_degree" value={formData.pg_degree} onChange={(e) => handleChange("pg_degree", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pg_college">College</Label>
                    <Input id="pg_college" value={formData.pg_college} onChange={(e) => handleChange("pg_college", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="pg_university">University</Label>
                    <Input id="pg_university" value={formData.pg_university} onChange={(e) => handleChange("pg_university", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pg_year">Year</Label>
                    <Input id="pg_year" value={formData.pg_year} onChange={(e) => handleChange("pg_year", e.target.value)} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Medical Council */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Stethoscope className="h-5 w-5" />
                Medical Council
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mci_council_number">MCI Council Number</Label>
                  <Input id="mci_council_number" value={formData.mci_council_number} onChange={(e) => handleChange("mci_council_number", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mci_council_state">MCI Council State</Label>
                  <Input id="mci_council_state" value={formData.mci_council_state} onChange={(e) => handleChange("mci_council_state", e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="imr_registration_no">IMR Registration No</Label>
                <Input id="imr_registration_no" value={formData.imr_registration_no} onChange={(e) => handleChange("imr_registration_no", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* ASI / Organizations */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building className="h-5 w-5" />
                Organization Memberships
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="asi_membership_no">ASI Membership No</Label>
                  <Input id="asi_membership_no" value={formData.asi_membership_no} onChange={(e) => handleChange("asi_membership_no", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asi_state">ASI State</Label>
                  <Input id="asi_state" value={formData.asi_state} onChange={(e) => handleChange("asi_state", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="other_intl_org">Other International Org</Label>
                  <Input id="other_intl_org" value={formData.other_intl_org} onChange={(e) => handleChange("other_intl_org", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="other_intl_org_value">Org Membership ID</Label>
                  <Input id="other_intl_org_value" value={formData.other_intl_org_value} onChange={(e) => handleChange("other_intl_org_value", e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Membership Details */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <IdCard className="h-5 w-5" />
                Membership Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="membership_type">Membership Type</Label>
                  <Select
                    key={`membership-${member?.id || "new"}`}
                    defaultValue={member?.membership_type || undefined}
                    onValueChange={(v) => handleChange("membership_type", v)}
                  >
                    <SelectTrigger id="membership_type">
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
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    key={`status-${member?.id || "new"}`}
                    defaultValue={member?.status || undefined}
                    onValueChange={(v) => handleChange("status", v)}
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border bg-secondary/30">
                <div className="flex items-center gap-3">
                  <Vote className="h-5 w-5 text-violet-500" />
                  <div>
                    <p className="font-medium">Voting Rights</p>
                    <p className="text-sm text-muted-foreground">
                      Only Life Members [LM] have voting rights
                    </p>
                  </div>
                </div>
                <Switch
                  checked={formData.voting_eligible}
                  onCheckedChange={(checked) => handleChange("voting_eligible", checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" type="button" asChild>
              <Link href="/members">Cancel</Link>
            </Button>
            <Button type="submit" disabled={updateMember.isPending}>
              {updateMember.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
