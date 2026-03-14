import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing environment variables:")
  console.error("NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "Set" : "Missing")
  console.error("SUPABASE_SERVICE_ROLE_KEY:", supabaseKey ? "Set" : "Missing")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function setupDemo() {
  console.log("Setting up Abstract Demo Event...")

  // 1. Create test event
  const baseSlug = "amasicon26-demo"
  const timestamp = Date.now().toString(36)
  const slug = `${baseSlug}-${timestamp}`

  const eventData = {
    name: "AMASICON 2026 - Demo",
    short_name: "AMASICON26-DEMO",
    slug,
    description: "Demo event for abstract management system showcase",
    event_type: "conference",
    start_date: "2026-04-15",
    end_date: "2026-04-17",
    venue_name: "Demo Convention Center",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    timezone: "Asia/Kolkata",
    status: "draft",
    is_virtual: false,
    is_hybrid: false,
    total_faculty: 0,
    confirmed_faculty: 0,
    pending_faculty: 0,
    total_sessions: 0,
    total_delegates: 0,
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert(eventData)
    .select()
    .single()

  if (eventError) {
    console.error("Event creation failed:", eventError)
    return
  }
  console.log("Event created:", event.id)

  // 2. Create abstract settings
  const settingsData = {
    event_id: event.id,
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
    .insert(settingsData)

  if (settingsError) {
    console.error("Settings creation failed:", settingsError)
  } else {
    console.log("Abstract settings configured")
  }

  // 3. Create abstract categories
  const categories = [
    { name: "Bariatric Surgery", description: "Metabolic and bariatric surgical procedures", sort_order: 1, is_award_category: true, award_name: "Best Bariatric Paper" },
    { name: "Minimally Invasive Surgery", description: "Laparoscopic and robotic procedures", sort_order: 2 },
    { name: "Upper GI Surgery", description: "Esophageal, gastric, and hepatobiliary surgery", sort_order: 3 },
    { name: "Colorectal Surgery", description: "Colon and rectal surgical procedures", sort_order: 4 },
    { name: "Hernia Surgery", description: "Abdominal wall reconstruction and hernia repair", sort_order: 5 },
    { name: "Case Reports", description: "Interesting case presentations", sort_order: 6 },
    { name: "Video Presentations", description: "Surgical technique videos", sort_order: 7 },
  ]

  for (const cat of categories) {
    const { error } = await supabase
      .from("abstract_categories")
      .insert({ ...cat, event_id: event.id, is_active: true })

    if (error) console.error("Category error:", cat.name, error.message)
  }
  console.log("Created", categories.length, "abstract categories")

  // 4. Get categories for abstracts
  const { data: cats } = await supabase
    .from("abstract_categories")
    .select("id, name")
    .eq("event_id", event.id)

  // 5. Create sample abstracts
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
        event_id: event.id,
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

    if (error) console.error("Abstract error:", abs.title.substring(0, 30), error.message)
  }
  console.log("Created", abstractCount, "sample abstracts")

  console.log("\n============================================================")
  console.log("DEMO SETUP COMPLETE!")
  console.log("============================================================")
  console.log("Event ID:", event.id)
  console.log("Event Name:", event.name)
  console.log("\nDemo URLs:")
  console.log("Dashboard: https://collegeofmas.org.in/events/" + event.id + "/abstracts")
  console.log("Submit Abstract: https://collegeofmas.org.in/submit-abstract/" + event.id)
  console.log("============================================================")
}

setupDemo().catch(console.error)
