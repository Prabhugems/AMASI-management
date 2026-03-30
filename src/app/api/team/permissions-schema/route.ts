import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/api-auth'

const PERMISSIONS_SCHEMA = {
  modules: [
    {
      key: 'events',
      label: 'Events',
      description: 'Event creation and management',
      actions: ['view', 'create', 'edit', 'delete', 'publish'],
    },
    {
      key: 'faculty',
      label: 'Faculty',
      description: 'Faculty database management',
      actions: ['view', 'create', 'edit', 'delete', 'invite'],
    },
    {
      key: 'members',
      label: 'Members',
      description: 'AMASI membership management',
      actions: ['view', 'create', 'edit', 'delete'],
    },
    {
      key: 'registrations',
      label: 'Registrations',
      description: 'Event registrations and attendees',
      actions: ['view', 'create', 'edit', 'delete', 'check_in', 'export'],
    },
    {
      key: 'sessions',
      label: 'Sessions',
      description: 'Event sessions and scheduling',
      actions: ['view', 'create', 'edit', 'delete'],
    },
    {
      key: 'abstracts',
      label: 'Abstracts',
      description: 'Abstract submissions and reviews',
      actions: ['view', 'create', 'edit', 'delete', 'review', 'assign_reviewer'],
    },
    {
      key: 'finance',
      label: 'Finance',
      description: 'Payments, refunds, and financial reports',
      actions: ['view', 'refund', 'export'],
    },
    {
      key: 'travel',
      label: 'Travel',
      description: 'Travel bookings, flights, hotels',
      actions: ['view', 'create', 'edit', 'delete', 'export'],
    },
    {
      key: 'communications',
      label: 'Communications',
      description: 'Email and WhatsApp messaging',
      actions: ['view', 'send_email', 'send_whatsapp', 'manage_templates'],
    },
    {
      key: 'team',
      label: 'Team',
      description: 'Team member management',
      actions: ['view', 'invite', 'edit', 'delete'],
    },
    {
      key: 'reports',
      label: 'Reports',
      description: 'Analytics and reporting',
      actions: ['view', 'export'],
    },
    {
      key: 'forms',
      label: 'Forms',
      description: 'Form builder and submissions',
      actions: ['view', 'create', 'edit', 'delete', 'export'],
    },
    {
      key: 'certificates',
      label: 'Certificates',
      description: 'Certificate generation and templates',
      actions: ['view', 'create', 'edit', 'delete', 'generate'],
    },
    {
      key: 'badges',
      label: 'Badges',
      description: 'Badge templates and printing',
      actions: ['view', 'create', 'edit', 'delete', 'print'],
    },
  ],
  role_templates: {
    super_admin: 'all',
    admin: 'all_except_team_delete',
    coordinator: [
      'events.view', 'events.edit',
      'faculty.view', 'faculty.invite',
      'members.view',
      'registrations.*',
      'sessions.*',
      'abstracts.view',
      'communications.view', 'communications.send_email',
      'reports.view',
    ],
    travel: ['travel.*', 'registrations.view', 'faculty.view'],
    check_in: ['registrations.view', 'registrations.check_in', 'badges.view', 'badges.print'],
    finance: ['finance.*', 'registrations.view', 'registrations.export', 'reports.*'],
  },
}

/**
 * GET /api/team/permissions-schema
 * Returns the full permissions schema for the UI to render permission checkboxes.
 */
export async function GET() {
  try {
    const { user, error: authError } = await requireAdmin()

    if (authError || !user) {
      return authError || NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    return NextResponse.json(PERMISSIONS_SCHEMA)
  } catch (error) {
    console.error('Permissions schema error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch permissions schema' },
      { status: 500 }
    )
  }
}
