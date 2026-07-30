#!/usr/bin/env node
/**
 * Agenda Builder Phase 1 backfill: creates one `halls` row per distinct
 * `sessions.hall` text value (per event) and links `sessions.hall_id` to it.
 *
 * Read-only by default (dry run). Pass --commit to actually write.
 * --commit requires supabase/migrations/20260730_agenda_builder_halls.sql
 * to already be applied -- it will fail loudly (missing column/table) if not.
 *
 * Usage:
 *   node scripts/agenda-backfill-halls.mjs                # dry run, all events
 *   node scripts/agenda-backfill-halls.mjs --event <id>   # dry run, one event
 *   node scripts/agenda-backfill-halls.mjs --commit        # actually write
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const args = process.argv.slice(2)
const commit = args.includes('--commit')
const eventIdArg = args.includes('--event') ? args[args.indexOf('--event') + 1] : null

async function getEventIds() {
  if (eventIdArg) return [eventIdArg]
  const { data, error } = await supabase.from('events').select('id')
  if (error) throw error
  return data.map((e) => e.id)
}

async function backfillEvent(eventId) {
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, hall, hall_id')
    .eq('event_id', eventId)
    .not('hall', 'is', null)
  if (sessionsError) throw sessionsError
  if (!sessions.length) return { eventId, hallsCreated: 0, sessionsLinked: 0 }

  const distinctHallNames = [...new Set(sessions.map((s) => s.hall.trim()).filter(Boolean))]

  const { data: existingHalls, error: existingHallsError } = await supabase
    .from('halls')
    .select('id, name')
    .eq('event_id', eventId)
  if (existingHallsError) throw existingHallsError

  const nameToHallId = new Map(existingHalls.map((h) => [h.name, h.id]))
  const namesToCreate = distinctHallNames.filter((name) => !nameToHallId.has(name))

  console.log(`[${eventId}] ${distinctHallNames.length} distinct hall names, ${namesToCreate.length} to create`)

  if (commit && namesToCreate.length) {
    const { data: created, error: createError } = await supabase
      .from('halls')
      .insert(namesToCreate.map((name, i) => ({ event_id: eventId, name, display_order: i })))
      .select('id, name')
    if (createError) throw createError
    for (const h of created) nameToHallId.set(h.name, h.id)
  }

  const sessionsToLink = sessions.filter((s) => !s.hall_id && s.hall && nameToHallId.has(s.hall.trim()))
  console.log(`[${eventId}] ${sessionsToLink.length} sessions to link to a hall_id`)

  if (commit) {
    for (const session of sessionsToLink) {
      const hallId = nameToHallId.get(session.hall.trim())
      const { error: updateError } = await supabase
        .from('sessions')
        .update({ hall_id: hallId })
        .eq('id', session.id)
      if (updateError) throw updateError
    }
  }

  return { eventId, hallsCreated: namesToCreate.length, sessionsLinked: sessionsToLink.length }
}

async function main() {
  console.log(commit ? 'Running in COMMIT mode' : 'Running in DRY-RUN mode (pass --commit to write)')
  const eventIds = await getEventIds()
  const results = []
  for (const eventId of eventIds) {
    results.push(await backfillEvent(eventId))
  }
  const totals = results.reduce(
    (acc, r) => ({ hallsCreated: acc.hallsCreated + r.hallsCreated, sessionsLinked: acc.sessionsLinked + r.sessionsLinked }),
    { hallsCreated: 0, sessionsLinked: 0 }
  )
  console.log(`\nTotal: ${totals.hallsCreated} halls, ${totals.sessionsLinked} sessions linked across ${eventIds.length} events`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
