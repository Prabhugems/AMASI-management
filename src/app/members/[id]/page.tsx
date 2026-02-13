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
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"

export default function MemberDetailPage() {
  const params = useParams()
  const memberId = params.id as string

  const supabase = createClient()

  // Fetch member data
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

        {/* Member Info Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                {member.name}
              </CardTitle>
              {getStatusBadge(member.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <IdCard className="h-4 w-4" />
                  AMASI Number
                </p>
                <p className="font-medium">{member.amasi_number || "N/A"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </p>
                <p className="font-medium">{member.email || "N/A"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone
                </p>
                <p className="font-medium">{member.phone || "N/A"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">ASI Member ID</p>
                <p className="font-medium">{member.asi_member_id || "N/A"}</p>
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
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Membership Type</p>
                <p className="font-medium">{member.membership_type || "N/A"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Status</p>
                {getStatusBadge(member.status)}
              </div>
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
