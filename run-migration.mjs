import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jmdwxymbgxwdsmcwbahp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptZHd4eW1iZ3h3ZHNtY3diYWhwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzAxMTA1NSwiZXhwIjoyMDgyNTg3MDU1fQ.rvk94RhIk7lcDonsR_dWdPL7rEzmn91tdXLChDg9b4Y'
)

// Get an event
const { data: events } = await supabase.from('events').select('id').limit(1)
const eventId = events?.[0]?.id

if (eventId) {
  // Try insert with topics as array
  const { data, error } = await supabase.from('sessions').insert({
    event_id: eventId,
    session_name: 'Test Session',
    session_date: '2026-01-30',
    start_time: '09:00:00',
    end_time: '10:00:00',
    session_type: 'lecture',
    hall: 'Hall A',
    description: 'Test session with speaker info',
    duration_minutes: 60,
    topics: ['Dr Test Speaker (test@email.com)'],
  }).select()

  if (error) {
    console.log('Insert error:', error.message)
  } else {
    console.log('Success! Data:', data[0])

    // Delete test record
    await supabase.from('sessions').delete().eq('id', data[0].id)
    console.log('Test record deleted')
  }
}
