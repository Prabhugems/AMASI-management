"use client"

import { CSVImport } from "@/components/ui/csv-import"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function ImportFacultyPage() {
  const templateColumns = [
    { name: "Name", description: "Full name", required: true, example: "Dr. John Doe" },
    { name: "Email", description: "Email address", required: true, example: "john@example.com" },
    { name: "Phone", description: "Phone number", example: "9876543210" },
    { name: "Title", description: "Title (Dr., Prof., etc.)", example: "Dr." },
    { name: "Designation", description: "Job title", example: "Professor" },
    { name: "Department", description: "Department name", example: "Obstetrics & Gynecology" },
    { name: "Institution", description: "Hospital/University name", example: "AIIMS Delhi" },
    { name: "Specialty", description: "Medical specialty", example: "Laparoscopy" },
    { name: "City", description: "City", example: "Delhi" },
    { name: "State", description: "State", example: "Delhi" },
    { name: "Country", description: "Country", example: "India" },
    { name: "Status", description: "Status (active/inactive)", example: "active" },
    { name: "Is Reviewer", description: "Is reviewer? (true/false)", example: "false" },
  ]

  const columnMappings = [
    { csvColumn: "Name", dbColumn: "name", required: true },
    { csvColumn: "Email", dbColumn: "email", required: true },
    { csvColumn: "Phone", dbColumn: "phone" },
    { csvColumn: "Title", dbColumn: "title" },
    { csvColumn: "Designation", dbColumn: "designation" },
    { csvColumn: "Department", dbColumn: "department" },
    { csvColumn: "Institution", dbColumn: "institution" },
    { csvColumn: "Specialty", dbColumn: "specialty" },
    { csvColumn: "City", dbColumn: "city" },
    { csvColumn: "State", dbColumn: "state" },
    { csvColumn: "Country", dbColumn: "country" },
    { csvColumn: "Status", dbColumn: "status" },
    { csvColumn: "Is Reviewer", dbColumn: "is_reviewer" },
  ]

  const handleImport = async (data: Record<string, any>[]) => {
    const response = await fetch("/api/import/faculty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: data }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Import failed")
    }

    return response.json()
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href="/faculty"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Faculty
          </Link>
        </div>

        {/* Import Component */}
        <div className="bg-card border border-border rounded-xl p-6">
          <CSVImport
            title="Import Faculty"
            description="Import faculty members from a CSV file. Existing emails will be updated."
            templateColumns={templateColumns}
            columnMappings={columnMappings}
            onImport={handleImport}
            templateFileName="faculty_import_template.csv"
          />
        </div>
      </div>
    </DashboardLayout>
  )
}
