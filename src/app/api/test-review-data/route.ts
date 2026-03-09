import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// POST /api/test-review-data - Create test abstracts and reviews for testing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { reviewerEmail, eventId } = body

    if (!reviewerEmail || !eventId) {
      return NextResponse.json({ error: "reviewerEmail and eventId required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Get reviewer
    const { data: reviewer } = await (supabase as any)
      .from("reviewers_pool")
      .select("id, email, name")
      .eq("email", reviewerEmail)
      .single()

    if (!reviewer) {
      return NextResponse.json({ error: "Reviewer not found" }, { status: 404 })
    }

    // Create test abstracts - comprehensive set for testing all categories
    const testAbstracts = [
      // ===== AWARD CATEGORIES (Full Scoring) =====

      // Best Paper Award
      {
        event_id: eventId,
        abstract_number: "AWARD-BP-001",
        title: "Laparoscopic Cholecystectomy Outcomes in Cirrhotic Patients: A Randomized Controlled Trial",
        abstract_text: "Background: Laparoscopic cholecystectomy (LC) in cirrhotic patients remains challenging. This RCT evaluates safety and outcomes of LC vs open cholecystectomy in patients with Child-Pugh A and B cirrhosis.\n\nMethods: 120 cirrhotic patients randomized to LC (n=60) vs open (n=60) between 2023-2025. Primary outcomes included operative time, blood loss, conversion rate, and 30-day morbidity.\n\nResults: LC group showed significantly reduced blood loss (120±45ml vs 280±80ml, p<0.001), shorter hospital stay (2.1±0.8 vs 5.3±1.2 days, p<0.001). Conversion rate 6.7%. No mortality in either group.\n\nConclusion: LC is superior to open cholecystectomy in selected cirrhotic patients.",
        keywords: ["laparoscopy", "cholecystectomy", "cirrhosis", "RCT"],
        presentation_type: "oral",
        presenting_author_name: "Dr. Amit Kumar",
        presenting_author_email: "amit.kumar@test.com",
        presenting_author_affiliation: "AIIMS Delhi",
        status: "submitted",
        category_id: null, // Will be set to Best Paper Award category if exists
      },

      // Young Scholar Award
      {
        event_id: eventId,
        abstract_number: "AWARD-YS-001",
        title: "Machine Learning-Based Prediction of Surgical Site Infection After Laparoscopic Surgery",
        abstract_text: "Background: Surgical site infections (SSI) remain a significant complication. We developed an ML model to predict SSI risk.\n\nMethods: Prospective study of 2,500 laparoscopic surgeries. 15 variables analyzed including BMI, diabetes, operative time. Random Forest and XGBoost models developed.\n\nResults: XGBoost achieved AUC 0.89 for SSI prediction. Key predictors: operative time >120min (OR 3.2), diabetes (OR 2.8), BMI >35 (OR 2.1). Model validation cohort showed 85% sensitivity, 82% specificity.\n\nConclusion: ML-based prediction can identify high-risk patients for targeted SSI prevention.",
        keywords: ["machine learning", "SSI", "prediction", "laparoscopy"],
        presentation_type: "oral",
        presenting_author_name: "Dr. Sneha Patel (PG Resident)",
        presenting_author_email: "sneha.patel@test.com",
        presenting_author_affiliation: "KEM Hospital Mumbai",
        status: "submitted",
      },

      // Best Video Award - Institutional
      {
        event_id: eventId,
        abstract_number: "AWARD-VID-001",
        title: "Step-by-Step Technique of Robotic Whipple Procedure with Technical Pearls",
        abstract_text: "This award-submission video demonstrates the complete technique of robotic pancreaticoduodenectomy performed using the da Vinci Xi system at our institution.\n\nKey steps demonstrated:\n1. Patient positioning and port placement optimization\n2. Kocher maneuver and portal dissection techniques\n3. Gastric and jejunal transection with stapling\n4. Pancreatic transection and uncinate process dissection\n5. Modified Blumgart reconstruction technique\n\nOperative time: 5.5 hours. Blood loss: 150ml. Patient discharged POD 7. No pancreatic fistula.",
        keywords: ["robotic surgery", "whipple", "pancreaticoduodenectomy", "technique"],
        presentation_type: "video",
        presenting_author_name: "Dr. Priya Sharma",
        presenting_author_email: "priya.sharma@test.com",
        presenting_author_affiliation: "Medanta Hospital Gurugram",
        status: "submitted",
        file_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        file_name: "robotic_whipple_award.mp4",
      },

      // Best Video Award - Faculty
      {
        event_id: eventId,
        abstract_number: "AWARD-VID-002",
        title: "Totally Extraperitoneal (TEP) Repair for Complex Inguinal Hernias: Tips and Tricks",
        abstract_text: "Educational video demonstrating advanced TEP techniques for complex inguinal hernias including large indirect hernias, sliding hernias, and recurrent hernias.\n\nTechniques covered:\n1. Optimal balloon dissection for scarred space\n2. Handling large indirect sac\n3. Parietalization of cord structures\n4. Mesh placement and fixation strategies\n5. Managing bladder injury and vas injury\n\nCase series: 50 complex hernias with 98% success rate, 2% recurrence at 2-year follow-up.",
        keywords: ["TEP", "hernia", "inguinal", "laparoscopy"],
        presentation_type: "video",
        presenting_author_name: "Dr. Rajesh Gupta",
        presenting_author_email: "rajesh.gupta@test.com",
        presenting_author_affiliation: "Sir Ganga Ram Hospital Delhi",
        status: "submitted",
        file_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        file_name: "tep_complex_hernia.mp4",
      },

      // Best Poster Award
      {
        event_id: eventId,
        abstract_number: "AWARD-POST-001",
        title: "Impact of Enhanced Recovery Protocol on Outcomes After Laparoscopic Colorectal Surgery",
        abstract_text: "Objective: To evaluate impact of ERAS protocol on laparoscopic colorectal surgery outcomes.\n\nMethods: Prospective comparative study - ERAS (n=75) vs conventional (n=75) recovery protocols after laparoscopic colorectal resection.\n\nResults: ERAS group showed reduced time to first flatus (18±6 vs 36±12 hrs), earlier oral intake (POD 1 vs POD 3), shorter hospital stay (4.2±1.1 vs 7.8±2.3 days). Readmission rates similar (4% vs 5.3%).\n\nConclusion: ERAS significantly improves recovery without increasing complications.",
        keywords: ["ERAS", "colorectal", "laparoscopy", "recovery"],
        presentation_type: "poster",
        presenting_author_name: "Dr. Meera Krishnan",
        presenting_author_email: "meera.k@test.com",
        presenting_author_affiliation: "CMC Vellore",
        status: "submitted",
        file_url: "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.pdf",
        file_name: "eras_colorectal_poster.pdf",
      },

      // ===== REGULAR SUBMISSIONS (Simple Confirmation) =====

      // Free Paper (Oral)
      {
        event_id: eventId,
        abstract_number: "FP-001",
        title: "Laparoscopic Sleeve Gastrectomy: 5-Year Follow-up Results",
        abstract_text: "Background: Long-term outcomes of LSG remain important for patient counseling.\n\nMethods: 200 patients who underwent LSG followed for 5 years. Weight loss, comorbidity resolution, and quality of life assessed.\n\nResults: Mean %EWL at 5 years: 62%. Diabetes remission 78%, hypertension remission 65%. GERD developed in 18% requiring PPI. Quality of life significantly improved.\n\nConclusion: LSG provides durable weight loss with good comorbidity resolution at 5 years.",
        keywords: ["sleeve gastrectomy", "bariatric", "outcomes"],
        presentation_type: "oral",
        presenting_author_name: "Dr. Vikram Singh",
        presenting_author_email: "vikram.s@test.com",
        presenting_author_affiliation: "Max Hospital Saket",
        status: "submitted",
      },

      // Free Video
      {
        event_id: eventId,
        abstract_number: "FV-001",
        title: "Laparoscopic Splenectomy for Massive Splenomegaly: Surgical Technique",
        abstract_text: "Video demonstrating safe technique for laparoscopic splenectomy in massive splenomegaly (spleen >20cm).\n\nKey points: Patient positioning, port placement for large spleen, early hilar control, handling of splenic adhesions, specimen retrieval.\n\nCase: 25cm spleen removed laparoscopically with 8cm extraction incision. Operative time 150 minutes. Blood loss 200ml.",
        keywords: ["splenectomy", "splenomegaly", "laparoscopy"],
        presentation_type: "video",
        presenting_author_name: "Dr. Anjali Mehta",
        presenting_author_email: "anjali.m@test.com",
        presenting_author_affiliation: "Tata Memorial Hospital",
        status: "submitted",
        file_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        file_name: "lap_splenectomy.mp4",
      },

      // Free Poster
      {
        event_id: eventId,
        abstract_number: "POSTER-001",
        title: "Single Port Laparoscopic Appendectomy: Our Experience with 200 Cases",
        abstract_text: "Objective: To evaluate outcomes of single port laparoscopic appendectomy (SPLA).\n\nMethods: Retrospective analysis of 200 SPLA cases (2022-2025).\n\nResults: Mean age 28±12 years. Mean operative time 32±8 minutes. No conversions. Wound infection rate 1.5%. Excellent cosmetic outcomes.\n\nConclusion: SPLA is safe, feasible with good cosmetic results.",
        keywords: ["single port", "appendectomy", "SILS", "cosmesis"],
        presentation_type: "poster",
        presenting_author_name: "Dr. Rahul Verma",
        presenting_author_email: "rahul.verma@test.com",
        presenting_author_affiliation: "Apollo Hospital Chennai",
        status: "submitted",
      },
    ]

    // Insert abstracts
    const { data: abstracts, error: abstractError } = await (supabase as any)
      .from("abstracts")
      .insert(testAbstracts)
      .select()

    if (abstractError) {
      console.error("Error creating abstracts:", abstractError)
      return NextResponse.json({ error: "Failed to create abstracts", details: abstractError.message }, { status: 500 })
    }

    console.log("Created abstracts:", abstracts.length)

    // Create review assignments (use email only, not reviewer_id which links to users table)
    const reviews = abstracts.map((abstract: any) => ({
      abstract_id: abstract.id,
      reviewer_name: reviewer.name,
      reviewer_email: reviewer.email,
      review_type: "initial",
    }))

    const { data: reviewData, error: reviewError } = await (supabase as any)
      .from("abstract_reviews")
      .insert(reviews)
      .select()

    if (reviewError) {
      console.error("Error creating reviews:", reviewError)
      return NextResponse.json({ error: "Failed to create reviews", details: reviewError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      abstracts: abstracts.length,
      reviews: reviewData.length,
      message: `Created ${abstracts.length} test abstracts and assigned to ${reviewer.name}`,
    })
  } catch (error) {
    console.error("Error in POST /api/test-review-data:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/test-review-data - Update test data (fix video/PDF URLs)
export async function PATCH() {
  try {
    const supabase = await createAdminClient()

    // Use local test video (no CORS issues)
    const videoUrl = "/test_video.mp4"

    await (supabase as any)
      .from("abstracts")
      .update({ file_url: videoUrl })
      .eq("abstract_number", "AWARD-VID-001")

    await (supabase as any)
      .from("abstracts")
      .update({ file_url: videoUrl })
      .eq("abstract_number", "AWARD-VID-002")

    await (supabase as any)
      .from("abstracts")
      .update({ file_url: videoUrl })
      .eq("abstract_number", "FV-001")

    // Update poster abstract with real PDF URL
    await (supabase as any)
      .from("abstracts")
      .update({
        file_url: "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.pdf"
      })
      .eq("abstract_number", "AWARD-POST-001")

    return NextResponse.json({ success: true, message: "Updated video and PDF URLs" })
  } catch (error) {
    console.error("Error in PATCH /api/test-review-data:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/test-review-data - Clean up test data
export async function DELETE() {
  try {
    const supabase = await createAdminClient()

    // Delete test abstracts (will cascade to reviews)
    await supabase
      .from("abstracts")
      .delete()
      .like("abstract_number", "TEST-%")

    return NextResponse.json({ success: true, message: "Test data cleaned up" })
  } catch (error) {
    console.error("Error in DELETE /api/test-review-data:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
