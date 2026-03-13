#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const env = {}
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length) {
    env[key.trim()] = valueParts.join('=').trim()
  }
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey.trim())

// Migrations to run
const migrations = [
  '20260313_complete_abstract_workflow.sql',
  '20260313_abstract_drafts.sql',
]

async function runMigrations() {
  console.log('🚀 Running database migrations...\n')

  for (const migration of migrations) {
    const filePath = path.join(__dirname, '..', 'supabase', 'migrations', migration)

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Skipping ${migration} - file not found`)
      continue
    }

    console.log(`📄 Running ${migration}...`)

    const sql = fs.readFileSync(filePath, 'utf-8')

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

      if (error) {
        // Try running directly if RPC doesn't work
        // Split by semicolons and run each statement
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'))

        for (const statement of statements) {
          const { error: stmtError } = await supabase.from('_migrations_log').select('*').limit(0)
          // We can't run raw SQL via JS client, need to use REST API or dashboard
        }

        console.log(`⚠️  ${migration} - needs to be run via Supabase Dashboard`)
        console.log(`   Copy the SQL from: supabase/migrations/${migration}`)
      } else {
        console.log(`✅ ${migration} - completed`)
      }
    } catch (err) {
      console.log(`⚠️  ${migration} - run manually via Supabase Dashboard`)
    }
  }

  console.log('\n✨ Migration process complete!')
  console.log('\n📋 To run migrations manually:')
  console.log('   1. Go to https://supabase.com/dashboard')
  console.log('   2. Select your project')
  console.log('   3. Go to SQL Editor')
  console.log('   4. Copy & paste the migration SQL files')
}

runMigrations()
