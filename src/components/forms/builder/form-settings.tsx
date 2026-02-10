"use client"

import { Form } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Settings,
  Send,
  Bell,
  Lock,
  Mail,
  Shield,
} from "lucide-react"
import { useState } from "react"

interface FormSettingsProps {
  form: Form
  onUpdate: (updates: Partial<Form>) => void
}

export function FormSettings({ form, onUpdate }: FormSettingsProps) {
  const [emailInput, setEmailInput] = useState("")

  const addNotificationEmail = () => {
    if (!emailInput.trim()) return
    const emails = form.notification_emails || []
    if (!emails.includes(emailInput.trim())) {
      onUpdate({
        notification_emails: [...emails, emailInput.trim()],
      })
    }
    setEmailInput("")
  }

  const removeNotificationEmail = (email: string) => {
    const emails = form.notification_emails || []
    onUpdate({
      notification_emails: emails.filter((e) => e !== email),
    })
  }

  return (
    <div className="space-y-6">
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            General Settings
          </CardTitle>
          <CardDescription>
            Configure basic form settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Form Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="Enter form name"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description || ""}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Brief description of your form"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="slug">Form URL Slug</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">/f/</span>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) =>
                  onUpdate({
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                  })
                }
                placeholder="my-form"
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Your form will be available at: /f/{form.slug || "your-form-slug"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Submission Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Submission Settings
          </CardTitle>
          <CardDescription>
            Configure how submissions are handled
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="submit_button_text">Submit Button Text</Label>
            <Input
              id="submit_button_text"
              value={form.submit_button_text || "Submit"}
              onChange={(e) => onUpdate({ submit_button_text: e.target.value })}
              placeholder="Submit"
            />
          </div>

          <div>
            <Label htmlFor="success_message">Success Message</Label>
            <Textarea
              id="success_message"
              value={form.success_message || ""}
              onChange={(e) => onUpdate({ success_message: e.target.value })}
              placeholder="Thank you for your submission!"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="redirect_url">Redirect URL (Optional)</Label>
            <Input
              id="redirect_url"
              value={form.redirect_url || ""}
              onChange={(e) => onUpdate({ redirect_url: e.target.value })}
              placeholder="https://yoursite.com/thank-you"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Redirect users to this URL after submission instead of showing a success message
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="allow_multiple">Allow Multiple Submissions</Label>
              <p className="text-xs text-muted-foreground">
                Allow the same person to submit multiple responses
              </p>
            </div>
            <Switch
              id="allow_multiple"
              checked={form.allow_multiple_submissions}
              onCheckedChange={(checked) =>
                onUpdate({ allow_multiple_submissions: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Get notified when someone submits your form
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notify">Email Notifications</Label>
              <p className="text-xs text-muted-foreground">
                Receive an email for each new submission
              </p>
            </div>
            <Switch
              id="notify"
              checked={form.notify_on_submission}
              onCheckedChange={(checked) =>
                onUpdate({ notify_on_submission: checked })
              }
            />
          </div>

          {form.notify_on_submission && (
            <div className="space-y-3">
              <Label>Notification Emails</Label>
              <div className="flex gap-2">
                <Input
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="email@example.com"
                  type="email"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addNotificationEmail()
                    }
                  }}
                />
                <Button type="button" onClick={addNotificationEmail}>
                  Add
                </Button>
              </div>
              {form.notification_emails && form.notification_emails.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.notification_emails.map((email) => (
                    <div
                      key={email}
                      className="flex items-center gap-1 bg-secondary px-2 py-1 rounded text-sm"
                    >
                      <Mail className="w-3 h-3" />
                      {email}
                      <button
                        onClick={() => removeNotificationEmail(email)}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Access Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Access Control
          </CardTitle>
          <CardDescription>
            Control who can access and submit your form
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="is_public">Public Form</Label>
              <p className="text-xs text-muted-foreground">
                Anyone with the link can view and submit
              </p>
            </div>
            <Switch
              id="is_public"
              checked={form.is_public}
              onCheckedChange={(checked) => onUpdate({ is_public: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="requires_auth">Require Login</Label>
              <p className="text-xs text-muted-foreground">
                Users must be logged in to submit
              </p>
            </div>
            <Switch
              id="requires_auth"
              checked={form.requires_auth}
              onCheckedChange={(checked) => onUpdate({ requires_auth: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="is_member_form" className="flex items-center gap-2">
                AMASI Member Form
                <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                  Membership
                </span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Verify AMASI membership via email before proceeding
              </p>
            </div>
            <Switch
              id="is_member_form"
              checked={form.is_member_form || false}
              onCheckedChange={(checked) => onUpdate({ is_member_form: checked })}
            />
          </div>

          {form.is_member_form && (
            <div className="ml-4 p-3 bg-emerald-50 rounded-lg border border-emerald-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="membership_required_strict" className="text-sm">
                    Strict Membership Required
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Block non-members from submitting (e.g., for exams)
                  </p>
                </div>
                <Switch
                  id="membership_required_strict"
                  checked={form.membership_required_strict !== false}
                  onCheckedChange={(checked) => onUpdate({ membership_required_strict: checked })}
                />
              </div>
              <p className="text-xs text-gray-500 italic">
                When OFF: Non-members can proceed but membership is verified for discounts
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Limits
          </CardTitle>
          <CardDescription>
            Set limits on form submissions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="max_submissions">Maximum Submissions</Label>
            <Input
              id="max_submissions"
              type="number"
              value={form.max_submissions || ""}
              onChange={(e) =>
                onUpdate({
                  max_submissions: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="Unlimited"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty for unlimited submissions
            </p>
          </div>

          <div>
            <Label htmlFor="deadline">Submission Deadline</Label>
            <Input
              id="deadline"
              type="datetime-local"
              value={
                form.submission_deadline
                  ? new Date(form.submission_deadline).toISOString().slice(0, 16)
                  : ""
              }
              onChange={(e) =>
                onUpdate({
                  submission_deadline: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : undefined,
                })
              }
            />
            <p className="text-xs text-muted-foreground mt-1">
              Form will stop accepting submissions after this date
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
