/**
 * Script to create the FMAS Skill Course Exam Form
 * Run with: npx ts-node scripts/create-exam-form.ts
 */

import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function createExamForm(eventId: string) {
  console.log("Creating FMAS Exam Form...")

  // 1. Create the form
  const { data: form, error: formError } = await supabase
    .from("forms")
    .insert({
      name: "FMAS Skill Course Exam Application",
      description: "Complete this form to register for the FMAS Skill Course Exam. AMASI membership is mandatory.",
      slug: "fmas-exam-application",
      form_type: "event_registration",
      event_id: eventId,
      status: "published",
      is_public: true,
      submit_button_text: "Submit Application",
      success_message: "Your exam application has been submitted successfully. You will receive a confirmation email shortly.",
      primary_color: "#059669",
      notify_on_submission: true,
    })
    .select()
    .single()

  if (formError) {
    console.error("Error creating form:", formError)
    return
  }

  console.log("Form created:", form.id)

  // 2. Create form fields
  const fields = [
    // Section: Membership Verification (MANDATORY)
    {
      form_id: form.id,
      field_type: "heading",
      label: "AMASI Membership (Mandatory)",
      help_text: "You must be an AMASI member to register for the FMAS Exam",
      sort_order: 1,
      width: "full",
      settings: { size: "h2", color: "#059669" },
    },
    {
      form_id: form.id,
      field_type: "select",
      label: "Membership Type",
      placeholder: "Select your membership type",
      help_text: "Select Life Member if you have ASI Number, otherwise select ALM",
      is_required: true,
      sort_order: 2,
      width: "half",
      options: [
        { value: "life_member", label: "Life Member (with ASI Number)" },
        { value: "alm", label: "ALM Member (without ASI Number)" },
      ],
    },
    {
      form_id: form.id,
      field_type: "text",
      label: "AMASI Membership Number",
      placeholder: "Enter your AMASI membership number",
      help_text: "Your membership will be verified before confirmation",
      is_required: true,
      sort_order: 3,
      width: "half",
    },
    {
      form_id: form.id,
      field_type: "text",
      label: "ASI Number",
      placeholder: "Enter your ASI registration number",
      help_text: "Required for Life Members only",
      is_required: false,
      sort_order: 4,
      width: "half",
      conditional_logic: {
        action: "show",
        logic: "all",
        rules: [{ field_label: "Membership Type", operator: "equals", value: "life_member" }],
      },
    },

    // Section: Personal Details
    {
      form_id: form.id,
      field_type: "heading",
      label: "Personal Details",
      sort_order: 10,
      width: "full",
      settings: { size: "h2" },
    },
    {
      form_id: form.id,
      field_type: "select",
      label: "Salutation",
      is_required: true,
      sort_order: 11,
      width: "third",
      options: [
        { value: "Dr.", label: "Dr." },
        { value: "Prof.", label: "Prof." },
        { value: "Mr.", label: "Mr." },
        { value: "Ms.", label: "Ms." },
      ],
    },
    {
      form_id: form.id,
      field_type: "text",
      label: "Full Name",
      placeholder: "Enter your full name (without Dr./Prof.)",
      help_text: "As it should appear on your certificate",
      is_required: true,
      sort_order: 12,
      width: "full",
    },
    {
      form_id: form.id,
      field_type: "email",
      label: "Email Address",
      placeholder: "your.email@example.com",
      is_required: true,
      sort_order: 13,
      width: "half",
    },
    {
      form_id: form.id,
      field_type: "phone",
      label: "Mobile Number",
      placeholder: "+91 9876543210",
      is_required: true,
      sort_order: 14,
      width: "half",
    },
    {
      form_id: form.id,
      field_type: "text",
      label: "Designation",
      placeholder: "e.g., Associate Professor, Consultant",
      is_required: false,
      sort_order: 15,
      width: "half",
    },
    {
      form_id: form.id,
      field_type: "text",
      label: "Institution / Hospital",
      placeholder: "Name of your institution or hospital",
      is_required: true,
      sort_order: 16,
      width: "half",
    },
    {
      form_id: form.id,
      field_type: "text",
      label: "City",
      placeholder: "City",
      is_required: true,
      sort_order: 17,
      width: "third",
    },
    {
      form_id: form.id,
      field_type: "text",
      label: "State",
      placeholder: "State",
      is_required: true,
      sort_order: 18,
      width: "third",
    },
    {
      form_id: form.id,
      field_type: "text",
      label: "Country",
      placeholder: "Country",
      is_required: false,
      sort_order: 19,
      width: "third",
      settings: { default_value: "India" },
    },

    // Section: Qualification Details
    {
      form_id: form.id,
      field_type: "heading",
      label: "Qualification Details",
      sort_order: 30,
      width: "full",
      settings: { size: "h2" },
    },
    {
      form_id: form.id,
      field_type: "select",
      label: "Specialty",
      help_text: "This determines your exam day (Gynecology: Day 2, Surgery: Day 3)",
      is_required: true,
      sort_order: 31,
      width: "half",
      options: [
        { value: "gynecology", label: "Gynecology (MS/DGO/DNB - OBG)" },
        { value: "surgery", label: "Surgery (MS/DNB - General Surgery)" },
      ],
    },
    {
      form_id: form.id,
      field_type: "select",
      label: "Highest Qualification",
      is_required: true,
      sort_order: 32,
      width: "half",
      options: [
        { value: "MD", label: "MD" },
        { value: "MS", label: "MS" },
        { value: "DGO", label: "DGO" },
        { value: "DNB", label: "DNB" },
        { value: "MBBS", label: "MBBS" },
        { value: "Other", label: "Other" },
      ],
    },
    {
      form_id: form.id,
      field_type: "date",
      label: "Year of Passing PG",
      help_text: "Select the month and year you completed your Post Graduation",
      is_required: true,
      sort_order: 33,
      width: "half",
      settings: { format: "MMMM yyyy", picker_type: "month" },
    },
    {
      form_id: form.id,
      field_type: "text",
      label: "Medical Council Registration Number",
      placeholder: "State Medical Council Registration Number",
      is_required: true,
      sort_order: 34,
      width: "half",
    },

    // Section: Document Uploads
    {
      form_id: form.id,
      field_type: "heading",
      label: "Document Uploads",
      sort_order: 40,
      width: "full",
      settings: { size: "h2" },
    },
    {
      form_id: form.id,
      field_type: "paragraph",
      label: "Please upload clear scanned copies of the following documents in PDF or image format (max 5MB each)",
      sort_order: 41,
      width: "full",
    },
    {
      form_id: form.id,
      field_type: "file",
      label: "PG Degree Certificate (MD/MS/DGO/DNB)",
      help_text: "Upload your Post Graduate degree certificate",
      is_required: true,
      sort_order: 42,
      width: "full",
      settings: {
        accept: ".pdf,.jpg,.jpeg,.png",
        max_size_mb: 5,
        max_files: 1,
      },
    },
    {
      form_id: form.id,
      field_type: "file",
      label: "Medical Council Registration Certificate",
      help_text: "Upload your state medical council registration",
      is_required: true,
      sort_order: 43,
      width: "full",
      settings: {
        accept: ".pdf,.jpg,.jpeg,.png",
        max_size_mb: 5,
        max_files: 1,
      },
    },

    // Section: Publications (Optional - for 5 marks)
    {
      form_id: form.id,
      field_type: "heading",
      label: "Publications (Optional)",
      sort_order: 50,
      width: "full",
      settings: { size: "h2" },
    },
    {
      form_id: form.id,
      field_type: "paragraph",
      label: "Upload your published papers for additional 5 marks in the exam. You can upload up to 5 publications.",
      sort_order: 51,
      width: "full",
    },
    {
      form_id: form.id,
      field_type: "file",
      label: "Publication Documents",
      help_text: "Upload PDF copies of your published papers (up to 5 files)",
      is_required: false,
      sort_order: 52,
      width: "full",
      settings: {
        accept: ".pdf",
        max_size_mb: 10,
        max_files: 5,
      },
    },

    // Section: Declaration
    {
      form_id: form.id,
      field_type: "divider",
      label: "",
      sort_order: 60,
      width: "full",
    },
    {
      form_id: form.id,
      field_type: "checkbox",
      label: "I hereby declare that all the information provided above is true and correct to the best of my knowledge. I understand that providing false information may result in cancellation of my registration.",
      is_required: true,
      sort_order: 61,
      width: "full",
    },
    {
      form_id: form.id,
      field_type: "checkbox",
      label: "I agree to the terms and conditions of AMASI and the FMAS examination guidelines.",
      is_required: true,
      sort_order: 62,
      width: "full",
    },
  ]

  // Insert all fields
  for (const field of fields) {
    const { error: fieldError } = await supabase
      .from("form_fields")
      .insert(field as any)

    if (fieldError) {
      console.error(`Error creating field "${field.label}":`, fieldError.message)
    } else {
      console.log(`✓ Created field: ${field.label}`)
    }
  }

  console.log("\n✅ FMAS Exam Form created successfully!")
  console.log(`Form ID: ${form.id}`)
  console.log(`Form URL: /f/${form.slug}`)

  return form
}

// Get event ID from command line or use default
const eventId = process.argv[2]

if (!eventId) {
  console.log("Usage: npx ts-node scripts/create-exam-form.ts <event_id>")
  console.log("\nTo find your event ID, check the URL when viewing the event in admin.")
  process.exit(1)
}

createExamForm(eventId)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
