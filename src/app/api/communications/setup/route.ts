import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// POST /api/communications/setup
// Creates the communications tables if they don't exist
export async function POST() {
  try {
    const supabase = await createAdminClient()

    // Create communication_settings table
    const { error: settingsError } = await (supabase as any).rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS communication_settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_id UUID REFERENCES events(id) ON DELETE CASCADE,
          email_provider TEXT DEFAULT 'default',
          email_api_key TEXT,
          email_from_address TEXT,
          email_from_name TEXT,
          whatsapp_provider TEXT,
          whatsapp_api_key TEXT,
          whatsapp_phone_number_id TEXT,
          whatsapp_business_account_id TEXT,
          whatsapp_access_token TEXT,
          sms_provider TEXT,
          sms_api_key TEXT,
          sms_sender_id TEXT,
          sms_auth_token TEXT,
          twilio_account_sid TEXT,
          twilio_auth_token TEXT,
          twilio_phone_number TEXT,
          webhook_enabled BOOLEAN DEFAULT false,
          webhook_url TEXT,
          webhook_secret TEXT,
          webhook_headers JSONB DEFAULT '{}',
          channels_enabled JSONB DEFAULT '{"email": true, "whatsapp": false, "sms": false, "webhook": false}',
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now(),
          UNIQUE(event_id)
        );
      `
    })

    if (settingsError && !settingsError.message?.includes('already exists')) {
      console.error('Error creating communication_settings:', settingsError)
    }

    // Create message_templates table
    const { error: templatesError } = await (supabase as any).rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS message_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_id UUID REFERENCES events(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT,
          channel TEXT NOT NULL,
          email_subject TEXT,
          email_body TEXT,
          message_body TEXT,
          whatsapp_template_name TEXT,
          whatsapp_template_namespace TEXT,
          whatsapp_template_language TEXT DEFAULT 'en',
          variables JSONB DEFAULT '[]',
          is_system BOOLEAN DEFAULT false,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );
      `
    })

    if (templatesError && !templatesError.message?.includes('already exists')) {
      console.error('Error creating message_templates:', templatesError)
    }

    // Create message_logs table
    const { error: logsError } = await (supabase as any).rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS message_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_id UUID REFERENCES events(id) ON DELETE SET NULL,
          registration_id UUID REFERENCES registrations(id) ON DELETE SET NULL,
          template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
          channel TEXT NOT NULL,
          provider TEXT,
          recipient TEXT NOT NULL,
          recipient_name TEXT,
          subject TEXT,
          message_body TEXT,
          status TEXT DEFAULT 'pending',
          provider_message_id TEXT,
          error_message TEXT,
          sent_at TIMESTAMPTZ,
          delivered_at TIMESTAMPTZ,
          read_at TIMESTAMPTZ,
          failed_at TIMESTAMPTZ,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT now()
        );
      `
    })

    if (logsError && !logsError.message?.includes('already exists')) {
      console.error('Error creating message_logs:', logsError)
    }

    return NextResponse.json({
      success: true,
      message: "Communications tables setup complete. Please reload the PostgREST schema in your Supabase dashboard (Settings > API > Reload Schema).",
      note: "If tables already existed, this was a no-op.",
    })
  } catch (error: any) {
    console.error('Setup error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      hint: "The exec_sql function may not exist. You need to run the migration SQL directly in the Supabase SQL Editor.",
      sql_file: "/supabase/migrations/20260116_communications.sql"
    }, { status: 500 })
  }
}
