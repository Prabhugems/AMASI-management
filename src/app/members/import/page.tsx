"use client"

import { CSVImport } from "@/components/ui/csv-import"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function ImportMembersPage() {
  const templateColumns = [
    { name: "Name", description: "Full name", required: true, example: "Dr. John Doe" },
    { name: "Member ID", description: "AMASI number", required: true, example: "17681" },
    { name: "Email", description: "Email address", example: "john@example.com" },
    { name: "Mobile", description: "Mobile number", example: "9876543210" },
    { name: "Membership Type", description: "LM, ALM, ILM, ACM", example: "Life Member [LM]" },
    { name: "Status", description: "Membership status", example: "Membership Number Allotted" },
    { name: "Father's Name", description: "Father's name", example: "John Doe Sr." },
    { name: "DOB", description: "Date of birth (DD/MM/YYYY)", example: "15/01/1990" },
    { name: "Gender", description: "Male/Female/Other", example: "Male" },
    { name: "Nationality", description: "Nationality", example: "Indian" },
    { name: "Application No", description: "Application number", example: "L15804" },
    { name: "Application Date", description: "Date (DD/MM/YYYY)", example: "15/02/2026" },
    { name: "Mobile Code", description: "Country code", example: "+91" },
    { name: "Landline", description: "Landline number", example: "04422334455" },
    { name: "STD Code", description: "STD code", example: "044" },
    { name: "Street Address 1", description: "Address line 1", example: "123 Main St" },
    { name: "Street Address 2", description: "Address line 2", example: "Apt 4B" },
    { name: "City", description: "City", example: "Chennai" },
    { name: "State", description: "State", example: "Tamil Nadu" },
    { name: "Country", description: "Country", example: "India" },
    { name: "Postal/Zip Code", description: "Postal code", example: "600001" },
    { name: "Education - UG College", description: "UG college", example: "Madras Medical College" },
    { name: "Education - UG University", description: "UG university", example: "Tamil Nadu MGR Medical University" },
    { name: "Education - UG Year", description: "UG graduation year", example: "2015" },
    { name: "Education - PG Degree", description: "PG degree", example: "MS" },
    { name: "Education - PG College", description: "PG college", example: "AIIMS Delhi" },
    { name: "Education - PG University", description: "PG university", example: "AIIMS" },
    { name: "Education - PG Year", description: "PG graduation year", example: "2020" },
    { name: "MCI Council Number", description: "MCI council number", example: "TMC12345" },
    { name: "MCI Council State", description: "MCI council state", example: "Tamil Nadu" },
    { name: "IMR Registration No", description: "IMR registration", example: "IMR123456" },
    { name: "ASI Membership No", description: "ASI membership number", example: "FL12345" },
    { name: "ASI State", description: "ASI state chapter", example: "Tamil Nadu" },
    { name: "Other International Organization", description: "Other org membership", example: "N/A" },
    { name: "Other International Organization Value", description: "Other org ID", example: "N/A" },
  ]

  const columnMappings = [
    { csvColumn: "Name", dbColumn: "name", required: true },
    { csvColumn: "Member ID", dbColumn: "amasi_number", required: true },
    { csvColumn: "Email", dbColumn: "email" },
    { csvColumn: "Mobile", dbColumn: "phone" },
    { csvColumn: "Membership Type", dbColumn: "membership_type" },
    { csvColumn: "Status", dbColumn: "status" },
    { csvColumn: "Father's Name", dbColumn: "father_name" },
    { csvColumn: "DOB", dbColumn: "date_of_birth" },
    { csvColumn: "Gender", dbColumn: "gender" },
    { csvColumn: "Nationality", dbColumn: "nationality" },
    { csvColumn: "Application No", dbColumn: "application_no" },
    { csvColumn: "Application Date", dbColumn: "application_date" },
    { csvColumn: "Mobile Code", dbColumn: "mobile_code" },
    { csvColumn: "Landline", dbColumn: "landline" },
    { csvColumn: "STD Code", dbColumn: "std_code" },
    { csvColumn: "Street Address 1", dbColumn: "street_address_1" },
    { csvColumn: "Street Address 2", dbColumn: "street_address_2" },
    { csvColumn: "City", dbColumn: "city" },
    { csvColumn: "State", dbColumn: "state" },
    { csvColumn: "Country", dbColumn: "country" },
    { csvColumn: "Postal/Zip Code", dbColumn: "postal_code" },
    { csvColumn: "Education - UG College", dbColumn: "ug_college" },
    { csvColumn: "Education - UG University", dbColumn: "ug_university" },
    { csvColumn: "Education - UG Year", dbColumn: "ug_year" },
    { csvColumn: "Education - PG Degree", dbColumn: "pg_degree" },
    { csvColumn: "Education - PG College", dbColumn: "pg_college" },
    { csvColumn: "Education - PG University", dbColumn: "pg_university" },
    { csvColumn: "Education - PG Year", dbColumn: "pg_year" },
    { csvColumn: "MCI Council Number", dbColumn: "mci_council_number" },
    { csvColumn: "MCI Council State", dbColumn: "mci_council_state" },
    { csvColumn: "IMR Registration No", dbColumn: "imr_registration_no" },
    { csvColumn: "ASI Membership No", dbColumn: "asi_membership_no" },
    { csvColumn: "ASI State", dbColumn: "asi_state" },
    { csvColumn: "Other International Organization", dbColumn: "other_intl_org" },
    { csvColumn: "Other International Organization Value", dbColumn: "other_intl_org_value" },
  ]

  const handleImport = async (data: Record<string, any>[]) => {
    const response = await fetch("/api/import/members", {
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
            href="/members"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Members
          </Link>
        </div>

        {/* Import Component */}
        <div className="bg-card border border-border rounded-xl p-6">
          <CSVImport
            title="Import Members"
            description="Import AMASI members from a CSV file. Existing AMASI numbers will be updated with new data."
            templateColumns={templateColumns}
            columnMappings={columnMappings}
            onImport={handleImport}
            templateFileName="members_import_template.csv"
          />
        </div>
      </div>
    </DashboardLayout>
  )
}
