import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing environment variables")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Event ID from the previous run
const EVENT_ID = "645fbe07-b3a3-418d-93b8-a6cdfa595101"

async function setupDemoData() {
  console.log("Adding demo data to event:", EVENT_ID)

  // 1. Create abstract settings
  const settingsData = {
    event_id: EVENT_ID,
    submission_opens_at: new Date().toISOString(),
    submission_deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    revision_deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    notification_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    max_submissions_per_person: 5,
    max_authors: 10,
    word_limit: 300,
    require_registration: false,
    allowed_file_types: ["pdf", "doc", "docx"],
    max_file_size_mb: 10,
    presentation_types: ["oral", "poster", "video"],
    review_enabled: true,
    reviewers_per_abstract: 2,
    blind_review: true,
    notify_on_submission: true,
    notify_on_decision: true,
    submission_guidelines: "Please submit your abstract following the AMASI guidelines. Maximum 300 words.",
    author_guidelines: "All authors must be listed with their affiliations.",
  }

  const { error: settingsError } = await supabase
    .from("abstract_settings")
    .upsert(settingsData, { onConflict: "event_id" })

  if (settingsError) {
    console.error("Settings creation failed:", settingsError)
  } else {
    console.log("Abstract settings configured")
  }

  // 2. Get categories
  const { data: cats } = await supabase
    .from("abstract_categories")
    .select("id, name")
    .eq("event_id", EVENT_ID)

  console.log("Found", cats?.length || 0, "categories")

  // 3. Create sample abstracts
  const abstracts = [
    {
      title: "Outcomes of Single Anastomosis Gastric Bypass: A 5-Year Follow-up Study",
      abstract_text: "Background: Single anastomosis gastric bypass (SAGB) has emerged as an effective bariatric procedure. Methods: We retrospectively analyzed 250 patients who underwent SAGB at our center. Results: Mean excess weight loss was 72% at 5 years. Complication rate was 3.2%. Conclusion: SAGB demonstrates excellent long-term outcomes with low complication rates.",
      presenting_author_name: "Dr. Amit Kumar",
      presenting_author_email: "amit.kumar@demo.com",
      presenting_author_affiliation: "Apollo Hospital, Delhi",
      keywords: ["bariatric", "SAGB", "weight loss"],
      category_name: "Bariatric Surgery",
      presentation_type: "oral",
    },
    {
      title: "Robotic Approach to Complex Hiatal Hernia Repair",
      abstract_text: "Background: Complex hiatal hernias pose significant surgical challenges. Methods: We present our experience with 45 robotic hiatal hernia repairs. Results: Mean operative time was 180 minutes. Zero conversions. 2% recurrence at 2 years. Conclusion: Robotic approach offers excellent visualization and precision for complex hiatal hernias.",
      presenting_author_name: "Dr. Priya Sharma",
      presenting_author_email: "priya.sharma@demo.com",
      presenting_author_affiliation: "Max Hospital, Mumbai",
      keywords: ["robotic", "hiatal hernia", "MIS"],
      category_name: "Minimally Invasive Surgery",
      presentation_type: "oral",
    },
    {
      title: "Laparoscopic Management of Giant Ventral Hernia with Component Separation",
      abstract_text: "Background: Giant ventral hernias require complex reconstruction. Methods: 30 patients underwent laparoscopic TAR with mesh reinforcement. Results: Mean defect size 15cm. No recurrence at 18 months. Conclusion: Laparoscopic approach is feasible for giant ventral hernias with proper technique.",
      presenting_author_name: "Dr. Rajesh Patel",
      presenting_author_email: "rajesh.patel@demo.com",
      presenting_author_affiliation: "Lilavati Hospital, Mumbai",
      keywords: ["hernia", "TAR", "component separation"],
      category_name: "Hernia Surgery",
      presentation_type: "poster",
    },
    {
      title: "Video: Step-by-Step Technique for Intracorporeal Anastomosis in Right Colectomy",
      abstract_text: "This video demonstrates our standardized technique for intracorporeal ileocolic anastomosis during laparoscopic right colectomy. Key steps include proper mobilization, vessel ligation, specimen extraction, and stapled anastomosis creation.",
      presenting_author_name: "Dr. Sunil Mehta",
      presenting_author_email: "sunil.mehta@demo.com",
      presenting_author_affiliation: "Tata Memorial Hospital, Mumbai",
      keywords: ["video", "colectomy", "anastomosis"],
      category_name: "Video Presentations",
      presentation_type: "video",
    },
    {
      title: "Rare Case: Successful Management of Bouveret Syndrome with Endoscopic Approach",
      abstract_text: "We present a rare case of Bouveret syndrome in a 75-year-old female. Initial endoscopic lithotripsy failed. Successful extraction achieved with combined endoscopic and percutaneous approach. Patient recovered well without surgery.",
      presenting_author_name: "Dr. Meera Reddy",
      presenting_author_email: "meera.reddy@demo.com",
      presenting_author_affiliation: "AIIMS, Hyderabad",
      keywords: ["Bouveret", "case report", "endoscopy"],
      category_name: "Case Reports",
      presentation_type: "poster",
    },
  ]

  let abstractCount = 0
  for (const abs of abstracts) {
    const category = cats?.find(c => c.name === abs.category_name)
    abstractCount++
    const { error } = await supabase
      .from("abstracts")
      .insert({
        event_id: EVENT_ID,
        category_id: category?.id,
        abstract_number: "ABS-2026-" + String(abstractCount).padStart(3, "0"),
        title: abs.title,
        abstract_text: abs.abstract_text,
        presenting_author_name: abs.presenting_author_name,
        presenting_author_email: abs.presenting_author_email,
        presenting_author_affiliation: abs.presenting_author_affiliation,
        keywords: abs.keywords,
        presentation_type: abs.presentation_type,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        declarations_accepted: true,
      })

    if (error) {
      console.error("Abstract error:", abs.title.substring(0, 30), error.message)
    } else {
      console.log("Created abstract:", abs.title.substring(0, 40))
    }
  }
  console.log("Created", abstractCount, "sample abstracts")

  console.log("\n============================================================")
  console.log("DEMO DATA SETUP COMPLETE!")
  console.log("============================================================")
  console.log("Event ID:", EVENT_ID)
  console.log("\nDemo URLs:")
  console.log("Dashboard: https://collegeofmas.org.in/events/" + EVENT_ID + "/abstracts")
  console.log("Submit Abstract: https://collegeofmas.org.in/submit-abstract/" + EVENT_ID)
  console.log("============================================================")
}

setupDemoData().catch(console.error)
