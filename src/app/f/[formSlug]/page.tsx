"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Form, FormField } from "@/lib/types"
import { FormRenderer } from "@/components/forms/renderer/form-renderer"
import { Loader2, AlertCircle, CheckCircle2, Calendar, Sparkles, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { format } from "date-fns"

export default function PublicFormPage() {
  const params = useParams()
  const router = useRouter()
  const formSlug = params.formSlug as string

  const [isSubmitted, setIsSubmitted] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-form", formSlug],
    queryFn: async () => {
      const response = await fetch("/api/forms/public/" + formSlug)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Form not found")
      }
      return response.json()
    },
  })

  const submitMutation = useMutation({
    mutationFn: async ({ responses, verifiedEmails }: {
      responses: Record<string, unknown>
      verifiedEmails?: Record<string, string>
    }) => {
      const response = await fetch("/api/forms/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_id: data.form.id,
          responses,
          verified_emails: verifiedEmails,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to submit form")
      }

      return response.json()
    },
    onSuccess: () => {
      setIsSubmitted(true)
      if (data.form.redirect_url) {
        window.location.href = data.form.redirect_url
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = (responses: Record<string, unknown>, verifiedEmails?: Record<string, string>) => {
    submitMutation.mutate({ responses, verifiedEmails })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-100 via-purple-50 to-indigo-100">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-2xl animate-pulse">
            <FileText className="w-10 h-10 text-white" />
          </div>
          <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-700">Loading your form...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-rose-50 to-orange-50">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-10 mx-4 max-w-md text-center border border-red-200">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center mx-auto mb-6 shadow-lg">
            <AlertCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-gray-800 mb-3">Form Not Found</h1>
          <p className="text-gray-600 mb-8 text-lg">
            {(error as Error).message || "The form you are looking for does not exist."}
          </p>
          <Button
            onClick={() => router.push("/")}
            className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg"
          >
            Go Home
          </Button>
        </div>
      </div>
    )
  }

  const form: Form = data.form
  const fields: FormField[] = data.fields || []

  const isDeadlinePassed = form.submission_deadline
    ? new Date(form.submission_deadline) < new Date()
    : false

  const isMaxSubmissionsReached = form.max_submissions
    ? (data.submissionCount || 0) >= form.max_submissions
    : false

  if (isDeadlinePassed || isMaxSubmissionsReached) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: form.background_color || "#F5F3FF" }}
      >
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-10 mx-4 max-w-md text-center border border-amber-200">
          {form.logo_url && (
            <img src={form.logo_url} alt="Logo" className="max-h-16 mx-auto mb-6 object-contain" />
          )}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-6 shadow-lg">
            <AlertCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-gray-800 mb-3">Form Closed</h1>
          <p className="text-gray-600 mb-8 text-lg">
            {isDeadlinePassed
              ? "This form has passed its submission deadline"
              : "This form has reached its maximum number of submissions"}
          </p>
          <Button
            variant="outline"
            onClick={() => router.push("/")}
            className="border-2 border-amber-300 hover:bg-amber-50 font-bold px-8 py-3 rounded-xl"
          >
            Go Home
          </Button>
        </div>
      </div>
    )
  }

  if (isSubmitted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: form.background_color || "#F5F3FF" }}
      >
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-10 mx-4 max-w-md text-center border border-green-200">
          {form.logo_url && (
            <img src={form.logo_url} alt="Logo" className="max-h-16 mx-auto mb-6 object-contain" />
          )}
          <div
            className="w-24 h-24 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-2xl"
            style={{ background: `linear-gradient(135deg, ${form.primary_color || "#8B5CF6"}, ${form.primary_color ? form.primary_color + "CC" : "#7C3AED"})` }}
          >
            <CheckCircle2 className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-black mb-4" style={{ color: form.primary_color || "#8B5CF6" }}>
            Thank You!
          </h1>
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <p className="text-lg font-semibold text-gray-700">Response submitted successfully</p>
            <Sparkles className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-gray-600 text-lg whitespace-pre-wrap mb-6">
            {form.success_message || "Your response has been recorded."}
          </p>
          {form.allow_multiple_submissions && (
            <Button
              className="mt-4 font-bold px-8 py-3 rounded-xl shadow-lg"
              style={{ background: `linear-gradient(135deg, ${form.primary_color || "#8B5CF6"}, ${form.primary_color ? form.primary_color + "CC" : "#7C3AED"})` }}
              onClick={() => setIsSubmitted(false)}
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Submit Another Response
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-12" style={{ backgroundColor: form.background_color || "#F5F3FF" }}>
      {form.header_image_url && (
        <div className="max-w-3xl mx-auto px-4 mb-8">
          <div className="rounded-3xl overflow-hidden shadow-2xl border-4 border-white/50">
            <img src={form.header_image_url} alt="Form header" className="w-full h-56 object-cover" />
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-gray-200/50">
          {/* Form Header */}
          <div
            className="p-8 md:p-10"
            style={{ background: `linear-gradient(135deg, ${form.primary_color || "#8B5CF6"}15, ${form.primary_color || "#8B5CF6"}08)` }}
          >
            {form.logo_url && (
              <div className="flex justify-center mb-6">
                <img src={form.logo_url} alt="Logo" className="max-h-16 object-contain" />
              </div>
            )}
            <div className="flex items-center justify-center gap-3 mb-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                style={{ background: `linear-gradient(135deg, ${form.primary_color || "#8B5CF6"}, ${form.primary_color ? form.primary_color + "CC" : "#7C3AED"})` }}
              >
                <FileText className="w-6 h-6 text-white" />
              </div>
            </div>
            <h1
              className="text-3xl md:text-4xl font-black text-center mb-3"
              style={{ color: form.primary_color || "#8B5CF6" }}
            >
              {form.name}
            </h1>
            {form.description && (
              <p className="text-gray-600 text-center text-lg max-w-xl mx-auto">{form.description}</p>
            )}
            {form.submission_deadline && (
              <div
                className="flex items-center justify-center gap-2 mt-6 text-sm font-semibold px-5 py-2.5 rounded-full shadow-md inline-flex mx-auto"
                style={{
                  backgroundColor: `${form.primary_color || "#8B5CF6"}20`,
                  color: form.primary_color || "#8B5CF6"
                }}
              >
                <Calendar className="w-4 h-4" />
                <span>Submit by {format(new Date(form.submission_deadline), "MMMM d, yyyy")}</span>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="p-8 md:p-10 bg-gradient-to-b from-gray-50/50 to-white">
            <FormRenderer
              form={form}
              fields={fields}
              onSubmit={handleSubmit}
              isSubmitting={submitMutation.isPending}
            />
          </div>
        </div>

        <div className="text-center py-8">
          <p className="text-sm text-gray-500 font-medium flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            Powered by AMASI Forms
            <Sparkles className="w-4 h-4 text-violet-400" />
          </p>
        </div>
      </div>
    </div>
  )
}
