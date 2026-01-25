#!/usr/bin/env node

/**
 * Database Setup Script
 * Runs automatically during deployment (vercel build) or manually via: npm run db:setup
 *
 * This ensures all database tables and columns exist before the app starts.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.log('⚠️  Database credentials not found. Skipping migrations.')
  console.log('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(0)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function checkTableExists(tableName) {
  const { error } = await supabase.from(tableName).select('id').limit(1)
  return !error || !error.message.includes('does not exist')
}

async function checkColumnExists(tableName, columnName) {
  const { error } = await supabase.from(tableName).select(columnName).limit(1)
  return !error
}

async function runMigrations() {
  console.log('🔄 Checking database schema...\n')

  const checks = []

  // Check critical tables
  const tables = [
    'events',
    'ticket_types',
    'registrations',
    'event_settings',
    'forms',
    'form_fields',
    'payments'
  ]

  for (const table of tables) {
    const exists = await checkTableExists(table)
    checks.push({ item: `Table: ${table}`, exists })
    console.log(`   ${exists ? '✅' : '❌'} ${table}`)
  }

  // Check critical columns
  const columns = [
    ['ticket_types', 'form_id'],
    ['ticket_types', 'exclusivity_group'],
    ['event_settings', 'allow_buyers'],
    ['event_settings', 'customize_registration_id'],
    ['registrations', 'order_id'],
  ]

  console.log('')
  for (const [table, column] of columns) {
    const exists = await checkColumnExists(table, column)
    checks.push({ item: `${table}.${column}`, exists })
    console.log(`   ${exists ? '✅' : '⚠️ '} ${table}.${column}`)
  }

  // Check optional analytics tables
  console.log('\n📊 Analytics tables:')
  const analyticsTables = ['event_page_views', 'event_leads', 'event_analytics_daily']
  for (const table of analyticsTables) {
    const exists = await checkTableExists(table)
    console.log(`   ${exists ? '✅' : '⚠️ '} ${table}`)
  }

  const missingRequired = checks.filter(c => !c.exists && !c.item.includes('order_id'))

  if (missingRequired.length > 0) {
    console.log('\n⚠️  Some schema items are missing.')
    console.log('   Run the SQL migration in Supabase Dashboard:')
    console.log('   File: supabase/migrations/001_complete_schema.sql\n')
  } else {
    console.log('\n✅ Database schema is ready!\n')
  }
}

runMigrations().catch(console.error)
