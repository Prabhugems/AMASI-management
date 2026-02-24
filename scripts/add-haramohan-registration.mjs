#!/usr/bin/env node
/**
 * Add Haramohan Barik's MMAS Exam registration (paid 23/02/2026 via Razorpay)
 */
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://jmdwxymbgxwdsmcwbahp.supabase.co"
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptZHd4eW1iZ3h3ZHNtY3diYWhwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzAxMTA1NSwiZXhwIjoyMDgyNTg3MDU1fQ.rvk94RhIk7lcDonsR_dWdPL7rEzmn91tdXLChDg9b4Y"

const EVENT_ID = "8db2c778-c96d-46da-ac20-00604e764853"
const TICKET_TYPE_ID = "81082d07-587a-4026-877e-d6e2bc7c820f" // MMAS Exam
const FORM_ID = "e60e2972-5811-41b4-a936-18d733b62678"

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const certUrl = "https://member2025.s3.ap-south-1.amazonaws.com/events/Screenshot%202024-08-09%20at%2012.07.06%C3%A2%C2%80%C2%AFAM.png"

async function main() {
  console.log("=== Adding Haramohan Barik Registration ===\n")

  // Step 1: Create payment record
  console.log("Creating payment...")
  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .insert({
      payment_number: "PAY-20260223-5909",
      payment_type: "registration",
      payment_method: "razorpay",
      payer_name: "Haramohan Barik",
      payer_email: "docharamohan@gmail.com",
      payer_phone: "9439057833",
      amount: 17700,
      currency: "INR",
      tax_amount: 2700,
      discount_amount: 0,
      net_amount: 17700,
      status: "completed",
      event_id: EVENT_ID,
      completed_at: "2026-02-23T00:00:00+05:30",
      metadata: {
        ticket_type_id: TICKET_TYPE_ID,
        ticket_name: "MMAS Exam",
        quantity: 1,
        unit_price: 15000,
        manual_entry: true,
        razorpay_order_id: "order_5909",
      },
    })
    .select("id")
    .single()

  if (payErr) {
    console.error("Payment insert failed:", payErr)
    process.exit(1)
  }
  console.log(`Payment created: ${payment.id}\n`)

  // Step 2: Create registration
  console.log("Creating registration...")
  const { data: reg, error: regErr } = await supabase
    .from("registrations")
    .insert({
      event_id: EVENT_ID,
      ticket_type_id: TICKET_TYPE_ID,
      registration_number: "MMAS-BA1062",
      attendee_name: "Haramohan Barik",
      attendee_email: "docharamohan@gmail.com",
      attendee_phone: "9439057833",
      attendee_designation: "MS",
      attendee_institution: "Cuttack",
      attendee_city: "Cuttack",
      attendee_state: "Odisha",
      attendee_country: "India",
      quantity: 1,
      unit_price: 15000,
      tax_amount: 2700,
      discount_amount: 0,
      total_amount: 17700,
      status: "confirmed",
      payment_status: "completed",
      payment_id: payment.id,
      confirmed_at: "2026-02-23T00:00:00+05:30",
      participation_mode: "offline",
      custom_fields: {
        amasi_number: "15683",
        degree: "MS",
        ms_completion_date: "2018-06-29",
        place_of_work: "Cuttack",
      },
    })
    .select("id")
    .single()

  if (regErr) {
    console.error("Registration insert failed:", regErr)
    process.exit(1)
  }
  console.log(`Registration created: ${reg.id} (MMAS-BA1062)\n`)

  // Step 3: Create form submission
  console.log("Creating form submission...")
  const { error: subErr } = await supabase
    .from("form_submissions")
    .insert({
      form_id: FORM_ID,
      submitter_email: "docharamohan@gmail.com",
      submitter_name: "Haramohan Barik",
      responses: {
        // Email Address
        "08891124-2e99-48de-b2f9-ab7b0c170e6f": "docharamohan@gmail.com",
        // AMASI Membership Number
        "a4e4095a-e212-43eb-a2c1-f7c2ccf690bb": "15683",
        // First Name
        "d0c199b4-139b-4dc7-944a-de5cb42165c7": "Haramohan",
        // Last Name
        "8035d86e-f0f5-4960-94db-ec868c3622d7": "Barik",
        // Mobile Number
        "fbd68d4b-5457-43ad-849f-41e318de16b6": "9439057833",
        // Choose Your Degree Details
        "0473ac6d-1df8-467e-8d13-36931acf97ec": "MS",
        // When Did You Complete Your MS Degree
        "831cb201-4778-4560-81af-6c446ba6e39b": "2018-06-29",
        // Present Place Of Work
        "b3da7a9a-31e2-47b4-b6d3-5ba0fa1c18d7": "Cuttack",
        // Research Articles On Hernia Diseases
        "c9635c48-c657-4ab3-9e08-13c27be1eb10": [{ url: certUrl, name: "Research Article.png" }],
        // Any Hernia Surgery Video Personal Work (N/A)
        "da19a3cb-2091-4eb7-8643-5538714acab4": null,
        // MCh MAS/FNB/MS/DNB Pass Certificate
        "85f032b5-bbb8-4569-854c-0e3e2fcbfa24": [{ url: certUrl, name: "Pass Certificate.png" }],
      },
      status: "approved",
    })

  if (subErr) {
    console.error("Form submission insert failed:", subErr)
  } else {
    console.log("Form submission created\n")
  }

  // Step 4: Update quantity_sold
  console.log("Updating quantity_sold...")
  const { data: ticket } = await supabase
    .from("ticket_types")
    .select("quantity_sold")
    .eq("id", TICKET_TYPE_ID)
    .single()

  await supabase
    .from("ticket_types")
    .update({ quantity_sold: (ticket?.quantity_sold || 37) + 1 })
    .eq("id", TICKET_TYPE_ID)

  // Step 5: Update event_settings current_registration_number if exists
  // (No event_settings row for this event, so skip)

  console.log("=== Done! ===")
  console.log("Registration: MMAS-BA1062")
  console.log("Name: Haramohan Barik")
  console.log("Email: docharamohan@gmail.com")
  console.log("Ticket: MMAS Exam (₹17,700)")
  console.log("Status: confirmed")
}

main().catch(console.error)
