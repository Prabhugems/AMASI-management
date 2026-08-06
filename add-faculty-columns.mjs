import { createClient } from '@supabase/supabase-js'

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
if (!SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Run: node --env-file=.env.local add-faculty-columns.mjs')
}

const supabase = createClient(
  'https://jmdwxymbgxwdsmcwbahp.supabase.co',
  SERVICE_ROLE_KEY
)

async function addFacultyColumns() {
  // Use rpc to execute raw SQL
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS faculty_name TEXT;
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS faculty_email TEXT;
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS faculty_phone TEXT;
    `
  })

  if (error) {
    // Try direct insert to test columns
    const { data: event } = await supabase.from('events').select('id').limit(1)
    const testEventId = event?.[0]?.id

    if (testEventId) {
      // Try inserting with faculty fields
      const { error: insertError } = await supabase.from('sessions').insert({
        event_id: testEventId,
        session_name: 'Test Faculty Fields',
        session_date: '2026-01-30',
        start_time: '09:00:00',
        end_time: '10:00:00',
        session_type: 'lecture',
        faculty_name: 'Test Faculty',
        faculty_email: 'test@test.com',
        faculty_phone: '1234567890',
      }).select()

      if (insertError) {
        if (insertError.message.includes('column') && insertError.message.includes('does not exist')) {
          console.log('Faculty columns do not exist. Please run migration in Supabase dashboard:')
          console.log(`
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS faculty_name TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS faculty_email TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS faculty_phone TEXT;
          `)
        } else {
          console.log('Error:', insertError.message)
        }
      } else {
        console.log('Faculty columns already exist and working!')
        // Delete test record
        await supabase.from('sessions').delete().eq('session_name', 'Test Faculty Fields')
        console.log('Test record cleaned up')
      }
    }
  } else {
    console.log('Migration executed successfully')
  }
}

addFacultyColumns()
