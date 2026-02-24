#!/usr/bin/env node
/**
 * Creates the MMAS Hernia Exam Form, form fields, template, and links to ticket type.
 * Also fixes quantity_sold sync for MMAS-B ticket types.
 *
 * Usage: node scripts/create-mmas-hernia-form.mjs
 */

import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://jmdwxymbgxwdsmcwbahp.supabase.co"
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptZHd4eW1iZ3h3ZHNtY3diYWhwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzAxMTA1NSwiZXhwIjoyMDgyNTg3MDU1fQ.rvk94RhIk7lcDonsR_dWdPL7rEzmn91tdXLChDg9b4Y"

const EVENT_ID = "8db2c778-c96d-46da-ac20-00604e764853"

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  console.log("=== MMAS Hernia Exam Form Setup ===\n")

  // Step 1: Check if form already exists
  const { data: existingForm } = await supabase
    .from("forms")
    .select("id, name")
    .eq("event_id", EVENT_ID)
    .eq("name", "MMAS Hernia Exam Form")
    .limit(1)
    .single()

  if (existingForm) {
    console.log(`Form already exists: ${existingForm.id}`)
    console.log("Skipping form creation. Delete it first if you want to recreate.\n")
    return
  }

  // Step 2: Create the form
  console.log("Creating form...")
  const { data: form, error: formError } = await supabase
    .from("forms")
    .insert({
      name: "MMAS Hernia Exam Form",
      description: "Registration form for MMAS Hernia Exam - requires AMASI membership verification",
      form_type: "event_registration",
      event_id: EVENT_ID,
      status: "published",
      is_public: true,
      is_member_form: true,
      membership_required_strict: true,
      submit_button_text: "Submit Registration",
      success_message: "Thank you for registering for the MMAS Hernia Exam! You will receive a confirmation email shortly.",
      primary_color: "#059669",
    })
    .select("id")
    .single()

  if (formError) {
    console.error("Failed to create form:", formError)
    process.exit(1)
  }

  const formId = form.id
  console.log(`Form created: ${formId}\n`)

  // Step 3: Create form fields
  console.log("Creating form fields...")
  const fields = [
    {
      form_id: formId,
      field_type: "email",
      label: "Email Address",
      placeholder: "Enter your email address",
      is_required: true,
      sort_order: 0,
      settings: { member_lookup: true },
    },
    {
      form_id: formId,
      field_type: "text",
      label: "AMASI Membership Number",
      placeholder: "Your AMASI membership number",
      is_required: true,
      sort_order: 1,
    },
    {
      form_id: formId,
      field_type: "text",
      label: "First Name",
      placeholder: "Enter your first name",
      is_required: true,
      sort_order: 2,
    },
    {
      form_id: formId,
      field_type: "text",
      label: "Last Name",
      placeholder: "Enter your last name",
      is_required: true,
      sort_order: 3,
    },
    {
      form_id: formId,
      field_type: "phone",
      label: "Mobile Number",
      placeholder: "Enter your mobile number",
      is_required: true,
      sort_order: 4,
      settings: { show_country: true, default_country: "IN" },
    },
    {
      form_id: formId,
      field_type: "select",
      label: "Choose Your Degree Details",
      placeholder: "Select your degree",
      is_required: true,
      sort_order: 5,
      options: [
        { value: "MS", label: "MS" },
        { value: "MD", label: "MD" },
        { value: "MCh", label: "MCh" },
        { value: "DNB", label: "DNB" },
        { value: "FNB", label: "FNB" },
        { value: "MBBS", label: "MBBS" },
        { value: "Other", label: "Other" },
      ],
    },
    {
      form_id: formId,
      field_type: "date",
      label: "When Did You Complete Your MS Degree",
      help_text: "Select the date of your MS degree completion",
      is_required: true,
      sort_order: 6,
    },
    {
      form_id: formId,
      field_type: "text",
      label: "Present Place Of Work",
      placeholder: "Enter your current workplace",
      is_required: false,
      sort_order: 7,
    },
    {
      form_id: formId,
      field_type: "file",
      label: "Research Articles On Hernia Diseases",
      help_text: "Upload your research articles (PDF or DOC format, max 10MB each)",
      is_required: false,
      sort_order: 8,
      settings: {
        allow_multiple: true,
        max_files: 5,
        allowed_file_types: ["pdf", "doc", "docx"],
        max_file_size: 10,
      },
    },
    {
      form_id: formId,
      field_type: "file",
      label: "Any Hernia Surgery Video Personal Work",
      help_text: "Upload your hernia surgery video (MP4 or MOV format, max 100MB)",
      is_required: false,
      sort_order: 9,
      settings: {
        allow_multiple: false,
        max_files: 1,
        allowed_file_types: ["mp4", "mov"],
        max_file_size: 100,
      },
    },
    {
      form_id: formId,
      field_type: "file",
      label: "MCh MAS/FNB/MS/DNB Pass Certificate",
      help_text: "Upload your pass certificate(s) (PDF, JPG, or PNG format, max 10MB each)",
      is_required: true,
      sort_order: 10,
      settings: {
        allow_multiple: true,
        max_files: 5,
        allowed_file_types: ["pdf", "jpg", "jpeg", "png"],
        max_file_size: 10,
      },
    },
  ]

  const { error: fieldsError } = await supabase
    .from("form_fields")
    .insert(fields)

  if (fieldsError) {
    console.error("Failed to create fields:", fieldsError)
    process.exit(1)
  }
  console.log(`Created ${fields.length} form fields\n`)

  // Step 4: Link form to MMAS Exam ticket type
  console.log("Linking form to MMAS Exam ticket type...")
  const { data: ticketTypes } = await supabase
    .from("ticket_types")
    .select("id, name, quantity_sold, quantity_total")
    .eq("event_id", EVENT_ID)

  console.log("Ticket types found:", ticketTypes?.map(t => `${t.name} (${t.id})`))

  const mmasExamTicket = ticketTypes?.find(t => t.name.toLowerCase().includes("mmas exam"))

  if (mmasExamTicket) {
    const { error: linkError } = await supabase
      .from("ticket_types")
      .update({ form_id: formId })
      .eq("id", mmasExamTicket.id)

    if (linkError) {
      console.error("Failed to link form to ticket:", linkError)
    } else {
      console.log(`Linked form to ticket: ${mmasExamTicket.name} (${mmasExamTicket.id})\n`)
    }
  } else {
    console.warn("MMAS Exam ticket type not found - please link manually\n")
  }

  // Step 5: Create form template
  console.log("Creating form template...")
  const { error: templateError } = await supabase
    .from("form_templates")
    .insert({
      name: "MMAS Hernia Exam Form",
      description: "Exam registration form for MMAS Hernia course - includes AMASI membership verification, degree details, research articles, surgery videos, and pass certificates",
      category: "exam",
      is_system: true,
      form_config: {
        name: "MMAS Hernia Exam Form",
        description: "Registration form for MMAS Hernia Exam",
        form_type: "event_registration",
        is_member_form: true,
        membership_required_strict: true,
        settings: {
          submit_button_text: "Submit Registration",
          success_message: "Thank you for registering for the MMAS Hernia Exam!",
        },
        fields: fields.map(({ form_id: _fid, ...rest }) => rest),
      },
    })

  if (templateError) {
    console.error("Failed to create template:", templateError)
  } else {
    console.log("Form template created\n")
  }

  // Step 6: Fix quantity_sold for all ticket types in this event
  console.log("Syncing quantity_sold from registrations...")
  if (ticketTypes) {
    for (const ticket of ticketTypes) {
      const { count } = await supabase
        .from("registrations")
        .select("*", { count: "exact", head: true })
        .eq("ticket_type_id", ticket.id)
        .in("status", ["confirmed", "completed"])

      const actualSold = count || 0
      if (actualSold !== ticket.quantity_sold) {
        console.log(`  ${ticket.name}: DB has ${ticket.quantity_sold} sold, actual is ${actualSold} -> updating`)
        await supabase
          .from("ticket_types")
          .update({ quantity_sold: actualSold })
          .eq("id", ticket.id)
      } else {
        console.log(`  ${ticket.name}: ${ticket.quantity_sold} sold (in sync)`)
      }
    }
  }

  console.log("\n=== Done! ===")
  console.log(`Form ID: ${formId}`)
  console.log(`Event: ${EVENT_ID}`)
  console.log("Test at: https://collegeofmas.org.in/register/mmas-bhubaneswar-mlq8d044")
}

main().catch(console.error)
