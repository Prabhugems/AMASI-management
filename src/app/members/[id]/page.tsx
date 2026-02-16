"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  Pencil,
  User,
  Mail,
  Phone,
  Vote,
  Calendar,
  CheckCircle,
  XCircle,
  MapPin,
  GraduationCap,
  Stethoscope,
  Building,
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"

function DetailRow({ label, value }: { label: string; value: any }) {
  if (!value || value === "N/A") return null
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}

export default function MemberDetailPage() {
  const params = useParams()
  const memberId = params.id as string

  const supabase = createClient()

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

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  if (!member) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <p className="text-muted-foreground">Member not found</p>
          <Button asChild>
            <Link href="/members">Back to Members</Link>
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>
      case "expired":
        return <Badge variant="destructive">Expired</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    } catch {
      return dateStr
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
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
                Member Details
              </h1>
              <p className="text-sm text-muted-foreground">
                AMASI #{member.amasi_number}
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href={`/members/${memberId}/edit`}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Member
            </Link>
          </Button>
        </div>

        {/* Personal Information */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
              {getStatusBadge(member.status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <DetailRow label="Full Name" value={member.name} />
              <DetailRow label="AMASI Number" value={member.amasi_number} />
              <DetailRow label="Father's Name" value={member.father_name} />
              <DetailRow label="Date of Birth" value={formatDate(member.date_of_birth)} />
              <DetailRow label="Gender" value={member.gender} />
              <DetailRow label="Nationality" value={member.nationality} />
              <DetailRow label="Application No" value={member.application_no} />
              <DetailRow label="Application Date" value={formatDate(member.application_date)} />
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
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <DetailRow label="Email" value={member.email} />
              <DetailRow label="Mobile" value={member.phone ? `${member.mobile_code || ""} ${member.phone}`.trim() : null} />
              <DetailRow label="Landline" value={member.landline ? `${member.std_code || ""} ${member.landline}`.trim() : null} />
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        {(member.street_address_1 || member.city || member.state) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5" />
                Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <DetailRow label="Street Address 1" value={member.street_address_1} />
                <DetailRow label="Street Address 2" value={member.street_address_2} />
                <DetailRow label="City" value={member.city} />
                <DetailRow label="State" value={member.state} />
                <DetailRow label="Country" value={member.country} />
                <DetailRow label="Postal Code" value={member.postal_code} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Education */}
        {(member.ug_college || member.pg_college) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <GraduationCap className="h-5 w-5" />
                Education
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {member.ug_college && (
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-2">Undergraduate</p>
                  <div className="grid grid-cols-2 gap-4">
                    <DetailRow label="College" value={member.ug_college} />
                    <DetailRow label="University" value={member.ug_university} />
                    <DetailRow label="Year" value={member.ug_year} />
                  </div>
                </div>
              )}
              {member.pg_college && (
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-2">Postgraduate</p>
                  <div className="grid grid-cols-2 gap-4">
                    <DetailRow label="Degree" value={member.pg_degree} />
                    <DetailRow label="College" value={member.pg_college} />
                    <DetailRow label="University" value={member.pg_university} />
                    <DetailRow label="Year" value={member.pg_year} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Medical Council */}
        {(member.mci_council_number || member.imr_registration_no) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Stethoscope className="h-5 w-5" />
                Medical Council
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <DetailRow label="MCI Council Number" value={member.mci_council_number} />
                <DetailRow label="MCI Council State" value={member.mci_council_state} />
                <DetailRow label="IMR Registration No" value={member.imr_registration_no} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ASI / Organizations */}
        {(member.asi_membership_no || member.other_intl_org) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building className="h-5 w-5" />
                Organization Memberships
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <DetailRow label="ASI Membership No" value={member.asi_membership_no} />
                <DetailRow label="ASI State" value={member.asi_state} />
                <DetailRow label="Other International Org" value={member.other_intl_org} />
                <DetailRow label="Org Membership ID" value={member.other_intl_org_value} />
              </div>
            </CardContent>
          </Card>
        )}

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
              <DetailRow label="Membership Type" value={member.membership_type} />
              <DetailRow label="Status" value={member.status} />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border bg-secondary/30">
              <div className="flex items-center gap-3">
                <Vote className="h-5 w-5 text-violet-500" />
                <div>
                  <p className="font-medium">Voting Rights</p>
                  <p className="text-sm text-muted-foreground">
                    {member.voting_eligible
                      ? "Eligible to vote in AMASI elections"
                      : "Not eligible for voting"}
                  </p>
                </div>
              </div>
              {member.voting_eligible ? (
                <CheckCircle className="h-6 w-6 text-green-500" />
              ) : (
                <XCircle className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Timestamps */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              Record Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">
                  {member.created_at
                    ? new Date(member.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "N/A"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Last Updated</p>
                <p className="font-medium">
                  {member.updated_at
                    ? new Date(member.updated_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
