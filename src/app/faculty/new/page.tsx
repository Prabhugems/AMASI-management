"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  ArrowLeft,
  GraduationCap,
  Loader2,
  Save,
  User,
  Mail,
  Phone,
  Building2,
  Briefcase,
  MapPin,
  Award,
  Search,
  UserCheck,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

const SALUTATION_OPTIONS = [
  { value: "Dr.", label: "Dr." },
  { value: "Prof.", label: "Prof." },
  { value: "Mr.", label: "Mr." },
  { value: "Mrs.", label: "Mrs." },
  { value: "Ms.", label: "Ms." },
]

export default function NewFacultyPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [memberFound, setMemberFound] = useState<any>(null)

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
  })

  const supabase = createClient()
  const queryClient = useQueryClient()
  const router = useRouter()

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Search for AMASI member by email or AMASI number
  const searchMember = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter an email or AMASI number")
      return
    }

    setIsSearching(true)
    try {
      let query = (supabase as any).from("members").select("*")

      // Check if it's a number (AMASI number) or email
      if (/^\d+$/.test(searchQuery.trim())) {
        query = query.eq("amasi_number", parseInt(searchQuery.trim()))
      } else {
        query = query.ilike("email", searchQuery.trim())
      }

      const { data, error } = await query.single()

      if (error || !data) {
        toast.error("Member not found")
        setMemberFound(null)
        return
      }

      // Check if already faculty
      const { data: existingFaculty } = await (supabase as any)
        .from("faculty")
        .select("id, name")
        .eq("email", data.email)
        .maybeSingle()

      if (existingFaculty) {
        toast.error(`${data.name} is already a faculty member`)
        return
      }

      // Auto-fill the form
      setFormData({
        title: "Dr.",
        name: data.name || "",
        email: data.email || "",
        phone: data.phone?.toString() || "",
        whatsapp: "",
        designation: "",
        department: "",
        institution: "",
        specialty: "",
        city: "",
        state: "",
        country: "India",
        bio: "",
      })

      setMemberFound(data)
      toast.success(`Found: ${data.name} (AMASI #${data.amasi_number})`)
    } catch (err) {
      toast.error("Search failed")
    } finally {
      setIsSearching(false)
    }
  }

  // Create faculty mutation
  const createFaculty = useMutation({
    mutationFn: async () => {
      if (!formData.name.trim()) {
        throw new Error("Name is required")
      }
      if (!formData.email.trim()) {
        throw new Error("Email is required")
      }

      const response = await fetch("/api/faculty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title || null,
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
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
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to create faculty")
      }

      return result.data
    },
    onSuccess: () => {
      toast.success(`${formData.name} has been added as faculty`)
      queryClient.invalidateQueries({ queryKey: ["faculty"] })
      router.push("/faculty")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createFaculty.mutate()
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
              Add New Faculty
            </h1>
            <p className="text-sm text-muted-foreground">
              Create a new faculty record manually
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Quick Add from Member */}
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserCheck className="h-5 w-5 text-primary" />
                Quick Add from AMASI Member
              </CardTitle>
              <CardDescription>
                Enter email or AMASI number to auto-fill details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Input
                  placeholder="Enter email or AMASI number (e.g., 1234)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchMember())}
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={searchMember}
                  disabled={isSearching}
                  variant="default"
                >
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Find Member
                    </>
                  )}
                </Button>
              </div>
              {memberFound && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                  Found: <strong>{memberFound.name}</strong> (AMASI #{memberFound.amasi_number})
                  {memberFound.membership_type && ` - ${memberFound.membership_type}`}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Personal Information */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Basic details about the faculty member
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Select value={formData.title || undefined} onValueChange={(v) => handleChange("title", v)}>
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
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    placeholder="Enter full name"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@example.com"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    required
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
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp (if different)</Label>
                <Input
                  id="whatsapp"
                  type="tel"
                  placeholder="+91 98765 43210"
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
              <CardDescription>
                Work and expertise details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="designation" className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Designation
                  </Label>
                  <Input
                    id="designation"
                    placeholder="e.g., Medical Superintendent"
                    value={formData.designation}
                    onChange={(e) => handleChange("designation", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    placeholder="e.g., Administration"
                    value={formData.department}
                    onChange={(e) => handleChange("department", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="institution">Institution / Hospital</Label>
                <Input
                  id="institution"
                  placeholder="e.g., AIIMS New Delhi"
                  value={formData.institution}
                  onChange={(e) => handleChange("institution", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialty" className="flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Specialty / Area of Expertise
                </Label>
                <Input
                  id="specialty"
                  placeholder="e.g., Hospital Administration, Healthcare Management"
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
              <CardDescription>
                Geographic information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="e.g., Mumbai"
                    value={formData.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    placeholder="e.g., Maharashtra"
                    value={formData.state}
                    onChange={(e) => handleChange("state", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    placeholder="India"
                    value={formData.country}
                    onChange={(e) => handleChange("country", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bio */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Bio / Notes</CardTitle>
              <CardDescription>
                Additional information about the faculty member
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Brief biography or notes about the faculty member..."
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
            <Button type="submit" disabled={createFaculty.isPending}>
              {createFaculty.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Faculty
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
