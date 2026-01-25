"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  GraduationCap,
  Loader2,
  Save,
  User,
  Mail,
  Phone,
  Building2,
  MapPin,
  Award,
  Star,
} from "lucide-react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"

const SALUTATION_OPTIONS = [
  { value: "Dr.", label: "Dr." },
  { value: "Prof.", label: "Prof." },
  { value: "Mr.", label: "Mr." },
  { value: "Mrs.", label: "Mrs." },
  { value: "Ms.", label: "Ms." },
]

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "blacklisted", label: "Blacklisted" },
]

export default function EditFacultyPage() {
  const params = useParams()
  const facultyId = params.id as string

  const [formData, setFormData] = useState({
    title: "",
    name: "",
    email: "",
    phone: "",
    whatsapp: "",
    designation: "",
    department: "",
    institution: "",
    specialty: "",
    city: "",
    state: "",
    country: "India",
    bio: "",
    status: "active",
    is_reviewer: false,
  })

  const supabase = createClient()
  const queryClient = useQueryClient()
  const router = useRouter()

  // Fetch faculty data
  const { data: faculty, isLoading } = useQuery({
    queryKey: ["faculty", facultyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("faculty")
        .select("*")
        .eq("id", facultyId)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!facultyId,
  })

  // Populate form when faculty data loads
  useEffect(() => {
    if (faculty) {
      setFormData({
        title: faculty.title || "",
        name: faculty.name || "",
        email: faculty.email || "",
        phone: faculty.phone || "",
        whatsapp: faculty.whatsapp || "",
        designation: faculty.designation || "",
        department: faculty.department || "",
        institution: faculty.institution || "",
        specialty: faculty.specialty || "",
        city: faculty.city || "",
        state: faculty.state || "",
        country: faculty.country || "India",
        bio: faculty.bio || "",
        status: faculty.status || "active",
        is_reviewer: faculty.is_reviewer || false,
      })
    }
  }, [faculty])

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Update faculty mutation
  const updateFaculty = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("faculty")
        .update({
          title: formData.title || null,
          name: formData.name || null,
          email: formData.email || null,
          phone: formData.phone || null,
          whatsapp: formData.whatsapp || null,
          designation: formData.designation || null,
          department: formData.department || null,
          institution: formData.institution || null,
          specialty: formData.specialty || null,
          city: formData.city || null,
          state: formData.state || null,
          country: formData.country || "India",
          bio: formData.bio || null,
          status: formData.status || "active",
          is_reviewer: formData.is_reviewer,
          updated_at: new Date().toISOString(),
        })
        .eq("id", facultyId)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Faculty updated successfully")
      queryClient.invalidateQueries({ queryKey: ["faculty"] })
      queryClient.invalidateQueries({ queryKey: ["faculty", facultyId] })
      router.push("/faculty")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateFaculty.mutate()
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
            <Link href="/faculty">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Faculty
            </Link>
          </Button>
          <div className="h-6 w-px bg-border" />
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <GraduationCap className="h-6 w-6" />
              Edit Faculty
            </h1>
            <p className="text-sm text-muted-foreground">
              {faculty?.title} {faculty?.name}
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
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Select
                    value={formData.title || undefined}
                    onValueChange={(v) => handleChange("title", v)}
                  >
                    <SelectTrigger id="title">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {SALUTATION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3 space-y-2">
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
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  type="tel"
                  value={formData.whatsapp}
                  onChange={(e) => handleChange("whatsapp", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Professional Information */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5" />
                Professional Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="designation">Designation</Label>
                  <Input
                    id="designation"
                    value={formData.designation}
                    onChange={(e) => handleChange("designation", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) => handleChange("department", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="institution">Institution</Label>
                <Input
                  id="institution"
                  value={formData.institution}
                  onChange={(e) => handleChange("institution", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialty" className="flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Specialty
                </Label>
                <Input
                  id="specialty"
                  value={formData.specialty}
                  onChange={(e) => handleChange("specialty", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5" />
                Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
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
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => handleChange("country", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status & Reviewer */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Star className="h-5 w-5" />
                Status & Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => handleChange("status", v)}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border bg-secondary/30">
                <div className="flex items-center gap-3">
                  <Star className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="font-medium">Reviewer Status</p>
                    <p className="text-sm text-muted-foreground">
                      Can review abstracts and papers
                    </p>
                  </div>
                </div>
                <Switch
                  checked={formData.is_reviewer}
                  onCheckedChange={(checked) => handleChange("is_reviewer", checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Bio */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Bio / Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Brief biography or notes..."
                value={formData.bio}
                onChange={(e) => handleChange("bio", e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" type="button" asChild>
              <Link href="/faculty">Cancel</Link>
            </Button>
            <Button type="submit" disabled={updateFaculty.isPending}>
              {updateFaculty.isPending ? (
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
