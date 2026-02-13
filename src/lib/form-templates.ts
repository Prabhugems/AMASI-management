import { FieldType, FieldWidth, FormType, FieldOption } from "@/lib/types"

export interface TemplateField {
  field_type: FieldType
  label: string
  placeholder?: string
  help_text?: string
  is_required: boolean
  options?: FieldOption[]
  width: FieldWidth
  settings?: Record<string, unknown>
}

export interface FormTemplateDefinition {
  id: string
  name: string
  description: string
  category: "feedback" | "event_registration" | "application" | "survey"
  form_type: FormType
  icon: string // lucide icon name
  fields: TemplateField[]
}

export const FORM_TEMPLATES: FormTemplateDefinition[] = [
  {
    id: "amasi-nextgen-feedback",
    name: "AMASI NextGen Feedback",
    description: "Official AMASI NextGen workshop feedback form with detailed session evaluation",
    category: "feedback",
    form_type: "feedback",
    icon: "ClipboardCheck",
    fields: [
      {
        field_type: "email",
        label: "Email Address",
        placeholder: "your.email@example.com",
        is_required: true,
        width: "full",
      },
      {
        field_type: "text",
        label: "Full Name",
        placeholder: "Enter your full name",
        is_required: true,
        width: "full",
      },
      {
        field_type: "radio",
        label: "How would you rate the overall organization of the workshop?",
        is_required: true,
        width: "full",
        options: [
          { value: "excellent", label: "Excellent" },
          { value: "good", label: "Good" },
          { value: "average", label: "Average" },
          { value: "below_average", label: "Below Average" },
          { value: "poor", label: "Poor" },
        ],
      },
      {
        field_type: "radio",
        label: "How would you rate the quality of the scientific sessions?",
        is_required: true,
        width: "full",
        options: [
          { value: "excellent", label: "Excellent" },
          { value: "good", label: "Good" },
          { value: "average", label: "Average" },
          { value: "below_average", label: "Below Average" },
          { value: "poor", label: "Poor" },
        ],
      },
      {
        field_type: "radio",
        label: "How would you rate the hands-on/practical sessions?",
        is_required: true,
        width: "full",
        options: [
          { value: "excellent", label: "Excellent" },
          { value: "good", label: "Good" },
          { value: "average", label: "Average" },
          { value: "below_average", label: "Below Average" },
          { value: "poor", label: "Poor" },
          { value: "na", label: "Not Applicable" },
        ],
      },
      {
        field_type: "radio",
        label: "How would you rate the faculty/speakers?",
        is_required: true,
        width: "full",
        options: [
          { value: "excellent", label: "Excellent" },
          { value: "good", label: "Good" },
          { value: "average", label: "Average" },
          { value: "below_average", label: "Below Average" },
          { value: "poor", label: "Poor" },
        ],
      },
      {
        field_type: "radio",
        label: "How relevant was the content to your clinical practice?",
        is_required: true,
        width: "full",
        options: [
          { value: "highly_relevant", label: "Highly Relevant" },
          { value: "somewhat_relevant", label: "Somewhat Relevant" },
          { value: "neutral", label: "Neutral" },
          { value: "not_very_relevant", label: "Not Very Relevant" },
          { value: "not_relevant", label: "Not Relevant at All" },
        ],
      },
      {
        field_type: "radio",
        label: "How would you rate the venue and facilities?",
        is_required: true,
        width: "full",
        options: [
          { value: "excellent", label: "Excellent" },
          { value: "good", label: "Good" },
          { value: "average", label: "Average" },
          { value: "below_average", label: "Below Average" },
          { value: "poor", label: "Poor" },
        ],
      },
      {
        field_type: "radio",
        label: "How would you rate the food and hospitality?",
        is_required: true,
        width: "full",
        options: [
          { value: "excellent", label: "Excellent" },
          { value: "good", label: "Good" },
          { value: "average", label: "Average" },
          { value: "below_average", label: "Below Average" },
          { value: "poor", label: "Poor" },
        ],
      },
      {
        field_type: "radio",
        label: "Would you recommend AMASI NextGen events to your colleagues?",
        is_required: true,
        width: "full",
        options: [
          { value: "definitely", label: "Definitely" },
          { value: "probably", label: "Probably" },
          { value: "not_sure", label: "Not Sure" },
          { value: "probably_not", label: "Probably Not" },
          { value: "definitely_not", label: "Definitely Not" },
        ],
      },
      {
        field_type: "radio",
        label: "How likely are you to attend future AMASI NextGen events?",
        is_required: true,
        width: "full",
        options: [
          { value: "very_likely", label: "Very Likely" },
          { value: "likely", label: "Likely" },
          { value: "neutral", label: "Neutral" },
          { value: "unlikely", label: "Unlikely" },
          { value: "very_unlikely", label: "Very Unlikely" },
        ],
      },
      {
        field_type: "textarea",
        label: "What did you like most about the event?",
        placeholder: "Share what you enjoyed the most...",
        is_required: false,
        width: "full",
      },
      {
        field_type: "textarea",
        label: "What suggestions do you have for improvement?",
        placeholder: "Your suggestions help us improve...",
        is_required: false,
        width: "full",
      },
      {
        field_type: "radio",
        label: "Overall, how would you rate this event?",
        is_required: true,
        width: "full",
        options: [
          { value: "5", label: "5 - Outstanding" },
          { value: "4", label: "4 - Very Good" },
          { value: "3", label: "3 - Good" },
          { value: "2", label: "2 - Fair" },
          { value: "1", label: "1 - Poor" },
        ],
      },
    ],
  },
  {
    id: "conference-registration",
    name: "Conference Registration",
    description: "Standard conference registration form with attendee details and preferences",
    category: "event_registration",
    form_type: "event_registration",
    icon: "UserPlus",
    fields: [
      {
        field_type: "text",
        label: "Full Name",
        placeholder: "Enter your full name",
        is_required: true,
        width: "full",
      },
      {
        field_type: "email",
        label: "Email Address",
        placeholder: "your.email@example.com",
        is_required: true,
        width: "half",
      },
      {
        field_type: "phone",
        label: "Phone Number",
        placeholder: "+91 9876543210",
        is_required: true,
        width: "half",
      },
      {
        field_type: "text",
        label: "Institution / Organization",
        placeholder: "Enter your institution name",
        is_required: true,
        width: "full",
      },
      {
        field_type: "text",
        label: "Designation",
        placeholder: "e.g., Professor, Resident, Consultant",
        is_required: true,
        width: "full",
      },
      {
        field_type: "select",
        label: "Dietary Preference",
        is_required: false,
        width: "half",
        options: [
          { value: "vegetarian", label: "Vegetarian" },
          { value: "non_vegetarian", label: "Non-Vegetarian" },
          { value: "vegan", label: "Vegan" },
          { value: "jain", label: "Jain" },
          { value: "no_preference", label: "No Preference" },
        ],
      },
      {
        field_type: "select",
        label: "T-Shirt Size",
        is_required: false,
        width: "half",
        options: [
          { value: "xs", label: "XS" },
          { value: "s", label: "S" },
          { value: "m", label: "M" },
          { value: "l", label: "L" },
          { value: "xl", label: "XL" },
          { value: "xxl", label: "XXL" },
        ],
      },
      {
        field_type: "textarea",
        label: "Special Requirements",
        placeholder: "Any accessibility needs, allergies, or other requirements...",
        is_required: false,
        width: "full",
      },
    ],
  },
  {
    id: "workshop-feedback",
    name: "Workshop Feedback",
    description: "Quick feedback form for workshops and training sessions",
    category: "feedback",
    form_type: "feedback",
    icon: "MessageSquare",
    fields: [
      {
        field_type: "text",
        label: "Name",
        placeholder: "Enter your name (optional)",
        is_required: false,
        width: "half",
      },
      {
        field_type: "email",
        label: "Email",
        placeholder: "your.email@example.com (optional)",
        is_required: false,
        width: "half",
      },
      {
        field_type: "rating",
        label: "Overall Rating",
        help_text: "Rate this workshop on a scale of 1-5",
        is_required: true,
        width: "full",
        settings: { max_rating: 5, rating_icon: "star" },
      },
      {
        field_type: "radio",
        label: "Was the content relevant to your needs?",
        is_required: true,
        width: "full",
        options: [
          { value: "very_relevant", label: "Very Relevant" },
          { value: "somewhat_relevant", label: "Somewhat Relevant" },
          { value: "not_relevant", label: "Not Relevant" },
        ],
      },
      {
        field_type: "radio",
        label: "How was the pace of the workshop?",
        is_required: true,
        width: "full",
        options: [
          { value: "too_fast", label: "Too Fast" },
          { value: "just_right", label: "Just Right" },
          { value: "too_slow", label: "Too Slow" },
        ],
      },
      {
        field_type: "radio",
        label: "Would you attend a follow-up session?",
        is_required: true,
        width: "full",
        options: [
          { value: "yes", label: "Yes" },
          { value: "maybe", label: "Maybe" },
          { value: "no", label: "No" },
        ],
      },
      {
        field_type: "textarea",
        label: "What did you find most valuable?",
        placeholder: "Tell us what worked well...",
        is_required: false,
        width: "full",
      },
      {
        field_type: "textarea",
        label: "Any suggestions for improvement?",
        placeholder: "Your feedback helps us improve...",
        is_required: false,
        width: "full",
      },
    ],
  },
  {
    id: "fmas-feedback",
    name: "FMAS Event Feedback",
    description: "Comprehensive feedback form for FMAS events covering course content, faculty, facilities, learning outcomes, and future course interests",
    category: "feedback",
    form_type: "feedback",
    icon: "ClipboardList",
    fields: [
      // Section 1: Course Content
      {
        field_type: "heading",
        label: "Course Content",
        is_required: false,
        width: "full",
        help_text: "Please rate the following aspects of the course content",
      },
      {
        field_type: "radio",
        label: "Relevance of topics covered",
        is_required: true,
        width: "full",
        options: [
          { value: "excellent", label: "Excellent" },
          { value: "very_good", label: "Very Good" },
          { value: "good", label: "Good" },
          { value: "poor", label: "Poor" },
        ],
      },
      {
        field_type: "radio",
        label: "Comprehensiveness of content",
        is_required: true,
        width: "full",
        options: [
          { value: "excellent", label: "Excellent" },
          { value: "very_good", label: "Very Good" },
          { value: "good", label: "Good" },
          { value: "poor", label: "Poor" },
        ],
      },
      {
        field_type: "radio",
        label: "Quality of presentation slides",
        is_required: true,
        width: "full",
        options: [
          { value: "excellent", label: "Excellent" },
          { value: "very_good", label: "Very Good" },
          { value: "good", label: "Good" },
          { value: "poor", label: "Poor" },
        ],
      },
      {
        field_type: "radio",
        label: "Quality of video demonstrations",
        is_required: true,
        width: "full",
        options: [
          { value: "excellent", label: "Excellent" },
          { value: "very_good", label: "Very Good" },
          { value: "good", label: "Good" },
          { value: "poor", label: "Poor" },
        ],
      },
      {
        field_type: "radio",
        label: "Balance between theory and practical aspects",
        is_required: true,
        width: "full",
        options: [
          { value: "excellent", label: "Excellent" },
          { value: "very_good", label: "Very Good" },
          { value: "good", label: "Good" },
          { value: "poor", label: "Poor" },
        ],
      },
      // Section 2: Faculty
      {
        field_type: "heading",
        label: "Faculty",
        is_required: false,
        width: "full",
        help_text: "Please rate the faculty on the following parameters",
      },
      {
        field_type: "radio",
        label: "Subject knowledge",
        is_required: true,
        width: "full",
        options: [
          { value: "excellent", label: "Excellent" },
          { value: "very_good", label: "Very Good" },
          { value: "good", label: "Good" },
          { value: "poor", label: "Poor" },
        ],
      },
      {
        field_type: "radio",
        label: "Presentation skills",
        is_required: true,
        width: "full",
        options: [
          { value: "excellent", label: "Excellent" },
          { value: "very_good", label: "Very Good" },
          { value: "good", label: "Good" },
          { value: "poor", label: "Poor" },
        ],
      },
      {
        field_type: "radio",
        label: "Interaction with participants",
        is_required: true,
        width: "full",
        options: [
          { value: "excellent", label: "Excellent" },
          { value: "very_good", label: "Very Good" },
          { value: "good", label: "Good" },
          { value: "poor", label: "Poor" },
        ],
      },
      {
        field_type: "radio",
        label: "Ability to clarify doubts",
        is_required: true,
        width: "full",
        options: [
          { value: "excellent", label: "Excellent" },
          { value: "very_good", label: "Very Good" },
          { value: "good", label: "Good" },
          { value: "poor", label: "Poor" },
        ],
      },
      // Section 3: Facilities and Organization
      {
        field_type: "heading",
        label: "Facilities and Organization",
        is_required: false,
        width: "full",
        help_text: "Please rate the following aspects",
      },
      {
        field_type: "radio",
        label: "Registration process",
        is_required: true,
        width: "full",
        options: [
          { value: "excellent", label: "Excellent" },
          { value: "very_good", label: "Very Good" },
          { value: "good", label: "Good" },
          { value: "poor", label: "Poor" },
        ],
      },
      {
        field_type: "radio",
        label: "Venue facilities",
        is_required: true,
        width: "full",
        options: [
          { value: "excellent", label: "Excellent" },
          { value: "very_good", label: "Very Good" },
          { value: "good", label: "Good" },
          { value: "poor", label: "Poor" },
        ],
      },
      {
        field_type: "radio",
        label: "Audio-visual arrangements",
        is_required: true,
        width: "full",
        options: [
          { value: "excellent", label: "Excellent" },
          { value: "very_good", label: "Very Good" },
          { value: "good", label: "Good" },
          { value: "poor", label: "Poor" },
        ],
      },
      {
        field_type: "radio",
        label: "Refreshments/meals",
        is_required: true,
        width: "full",
        options: [
          { value: "excellent", label: "Excellent" },
          { value: "very_good", label: "Very Good" },
          { value: "good", label: "Good" },
          { value: "poor", label: "Poor" },
        ],
      },
      {
        field_type: "radio",
        label: "Time management",
        is_required: true,
        width: "full",
        options: [
          { value: "excellent", label: "Excellent" },
          { value: "very_good", label: "Very Good" },
          { value: "good", label: "Good" },
          { value: "poor", label: "Poor" },
        ],
      },
      // Section 4: Open-ended Feedback
      {
        field_type: "textarea",
        label: "Any sessions that could be improved",
        placeholder: "Please describe any sessions you feel could be improved...",
        is_required: true,
        width: "full",
      },
      // Learning Outcomes
      {
        field_type: "heading",
        label: "Learning Outcomes",
        is_required: false,
        width: "full",
      },
      {
        field_type: "textarea",
        label: "What are the key skills/knowledge you gained from this course?",
        placeholder: "Describe the key skills or knowledge you gained...",
        is_required: true,
        width: "full",
      },
      {
        field_type: "textarea",
        label: "How do you plan to implement these in your practice?",
        placeholder: "Describe how you plan to apply what you learned...",
        is_required: true,
        width: "full",
      },
      // Suggestions for Improvement
      {
        field_type: "heading",
        label: "Suggestions for Improvement",
        is_required: false,
        width: "full",
      },
      {
        field_type: "textarea",
        label: "What additional topics would you like to see covered in future courses?",
        placeholder: "Suggest topics for future courses...",
        is_required: true,
        width: "full",
      },
      {
        field_type: "textarea",
        label: "How can we improve the course experience?",
        placeholder: "Share your suggestions for improvement...",
        is_required: true,
        width: "full",
      },
      // Future Courses
      {
        field_type: "heading",
        label: "Future Courses",
        is_required: false,
        width: "full",
      },
      {
        field_type: "radio",
        label: "Would you recommend this course to colleagues?",
        is_required: true,
        width: "full",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        field_type: "radio",
        label: "Are you interested in attending advanced MAS courses in the future?",
        is_required: true,
        width: "full",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        field_type: "textarea",
        label: "Specific areas of interest for future courses",
        placeholder: "Tell us what areas you'd like future courses to cover...",
        is_required: true,
        width: "full",
      },
      {
        field_type: "textarea",
        label: "Any Other Comments",
        placeholder: "Share any additional comments or feedback...",
        is_required: true,
        width: "full",
      },
    ],
  },
  {
    id: "speaker-application",
    name: "Speaker / Faculty Application",
    description: "Application form for speakers and faculty to submit their profiles and topics",
    category: "application",
    form_type: "application",
    icon: "Mic",
    fields: [
      {
        field_type: "text",
        label: "Full Name",
        placeholder: "Enter your full name",
        is_required: true,
        width: "full",
      },
      {
        field_type: "email",
        label: "Email Address",
        placeholder: "your.email@example.com",
        is_required: true,
        width: "half",
      },
      {
        field_type: "phone",
        label: "Phone Number",
        placeholder: "+91 9876543210",
        is_required: true,
        width: "half",
      },
      {
        field_type: "text",
        label: "Institution / Organization",
        placeholder: "Enter your institution name",
        is_required: true,
        width: "full",
      },
      {
        field_type: "text",
        label: "Designation",
        placeholder: "e.g., Professor, HOD, Consultant",
        is_required: true,
        width: "full",
      },
      {
        field_type: "textarea",
        label: "Brief Bio",
        placeholder: "A short professional biography (100-200 words)",
        help_text: "This may be used in event materials",
        is_required: true,
        width: "full",
      },
      {
        field_type: "text",
        label: "Proposed Topic",
        placeholder: "Title of your talk/presentation",
        is_required: true,
        width: "full",
      },
      {
        field_type: "textarea",
        label: "Abstract",
        placeholder: "Brief summary of your proposed presentation (200-300 words)",
        is_required: true,
        width: "full",
      },
      {
        field_type: "select",
        label: "Preferred Format",
        is_required: true,
        width: "half",
        options: [
          { value: "lecture", label: "Lecture" },
          { value: "workshop", label: "Workshop / Hands-on" },
          { value: "panel", label: "Panel Discussion" },
          { value: "live_demo", label: "Live Demo / Surgery" },
          { value: "any", label: "Any Format" },
        ],
      },
      {
        field_type: "select",
        label: "Availability",
        is_required: true,
        width: "half",
        options: [
          { value: "all_days", label: "All Days" },
          { value: "day_1", label: "Day 1 Only" },
          { value: "day_2", label: "Day 2 Only" },
          { value: "flexible", label: "Flexible" },
        ],
      },
    ],
  },
]

export function getTemplateById(id: string): FormTemplateDefinition | undefined {
  return FORM_TEMPLATES.find((t) => t.id === id)
}
