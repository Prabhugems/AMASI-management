"use client"

import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { FormBuilder } from "@/components/forms/builder/form-builder"
import { Form, FormField } from "@/lib/types"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function FormEditPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const formId = params.formId as string

  // Fetch form with fields
  const { data, isLoading, error } = useQuery({
    queryKey: ["form", formId],
    queryFn: async () => {
      const response = await fetch(`/api/forms/${formId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch form")
      }
      return response.json()
    },
  })

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async ({ form, fields }: { form: Partial<Form>; fields: FormField[] }) => {
      // Update form
      const formResponse = await fetch(`/api/forms/${formId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      if (!formResponse.ok) {
        const errorData = await formResponse.json().catch(() => ({}))
        console.error("Form save error:", errorData)
        throw new Error(errorData.details || errorData.error || "Failed to save form")
      }

      // Update fields - send all fields with their order
      const fieldsResponse = await fetch(`/api/forms/${formId}/fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      })

      if (!fieldsResponse.ok) {
        throw new Error("Failed to save fields")
      }

      return { form: await formResponse.json(), fields: await fieldsResponse.json() }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form", formId] })
      toast.success("Form saved successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSave = async (formUpdates: Partial<Form>, fields: FormField[]) => {
    await saveMutation.mutateAsync({ form: formUpdates, fields })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-destructive mb-4">Failed to load form</p>
        <button
          onClick={() => router.push("/forms")}
          className="text-primary hover:underline"
        >
          Back to Forms
        </button>
      </div>
    )
  }

  const form: Form = {
    id: data.id,
    name: data.name,
    description: data.description,
    slug: data.slug,
    form_type: data.form_type,
    event_id: data.event_id,
    status: data.status,
    is_public: data.is_public,
    requires_auth: data.requires_auth,
    allow_multiple_submissions: data.allow_multiple_submissions,
    is_member_form: data.is_member_form,
    membership_required_strict: data.membership_required_strict,
    submit_button_text: data.submit_button_text,
    success_message: data.success_message,
    redirect_url: data.redirect_url,
    logo_url: data.logo_url,
    header_image_url: data.header_image_url,
    primary_color: data.primary_color,
    background_color: data.background_color,
    notify_on_submission: data.notify_on_submission,
    notification_emails: data.notification_emails,
    max_submissions: data.max_submissions,
    submission_deadline: data.submission_deadline,
    created_by: data.created_by,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }

  const fields: FormField[] = (data.fields || []).map((f: any) => ({
    id: f.id,
    form_id: f.form_id,
    field_type: f.field_type,
    label: f.label,
    placeholder: f.placeholder,
    help_text: f.help_text,
    is_required: f.is_required,
    min_length: f.min_length,
    max_length: f.max_length,
    min_value: f.min_value,
    max_value: f.max_value,
    pattern: f.pattern,
    options: f.options,
    conditional_logic: f.conditional_logic,
    sort_order: f.sort_order,
    width: f.width,
    section_id: f.section_id,
    settings: f.settings,
    created_at: f.created_at,
    updated_at: f.updated_at,
  }))

  const backUrl = data.event_id ? `/events/${data.event_id}/forms` : "/forms"

  return (
    <FormBuilder
      form={form}
      initialFields={fields}
      onSave={handleSave}
      backUrl={backUrl}
    />
  )
}
