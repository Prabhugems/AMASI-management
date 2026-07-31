#!/usr/bin/env node
/**
 * Agenda Builder Phase 1 backfill: creates one `halls` row per distinct
 * `sessions.hall` text value (per event), links `sessions.hall_id` to it,
 * and does the same match for `hall_coordinators.hall_name` -> `hall_id`.
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

const PAGE_SIZE = 1000

// PostgREST caps a single response at PAGE_SIZE rows by default -- fetch in
// pages via .range() until a short page signals the end, so events with more
// matching rows than the cap don't silently get truncated.
async function fetchAllPages(query) {
  const rows = []
  let from = 0
  for (;;) {
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

async function getEventIds() {
  if (eventIdArg) return [eventIdArg]
  const data = await fetchAllPages(supabase.from('events').select('id'))
  return data.map((e) => e.id)
}

async function backfillEvent(eventId) {
  const sessions = await fetchAllPages(
    supabase.from('sessions').select('id, hall, hall_id').eq('event_id', eventId).not('hall', 'is', null)
  )
  if (!sessions.length) return { eventId, hallsCreated: 0, sessionsLinked: 0, coordinatorsLinked: 0 }

  const distinctHallNames = [...new Set(sessions.map((s) => s.hall.trim()).filter(Boolean))]

  const existingHalls = await fetchAllPages(supabase.from('halls').select('id, name').eq('event_id', eventId))

  const nameToHallId = new Map(existingHalls.map((h) => [h.name, h.id]))
  const namesToCreate = distinctHallNames.filter((name) => !nameToHallId.has(name))

  console.log(`[${eventId}] ${distinctHallNames.length} distinct hall names, ${namesToCreate.length} to create`)

  if (!commit) {
    for (const name of namesToCreate) nameToHallId.set(name, 'preview-only')
  }

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

  const coordinators = await fetchAllPages(
    supabase.from('hall_coordinators').select('id, hall_name, hall_id').eq('event_id', eventId).not('hall_name', 'is', null)
  )

  const coordinatorsToLink = coordinators.filter(
    (c) => !c.hall_id && c.hall_name && nameToHallId.has(c.hall_name.trim())
  )
  console.log(`[${eventId}] ${coordinatorsToLink.length} hall coordinators to link to a hall_id`)

  if (commit) {
    for (const coordinator of coordinatorsToLink) {
      const hallId = nameToHallId.get(coordinator.hall_name.trim())
      const { error: updateError } = await supabase
        .from('hall_coordinators')
        .update({ hall_id: hallId })
        .eq('id', coordinator.id)
      if (updateError) throw updateError
    }
  }

  return {
    eventId,
    hallsCreated: namesToCreate.length,
    sessionsLinked: sessionsToLink.length,
    coordinatorsLinked: coordinatorsToLink.length,
  }
}

async function main() {
  console.log(commit ? 'Running in COMMIT mode' : 'Running in DRY-RUN mode (pass --commit to write)')
  const eventIds = await getEventIds()
  const results = []
  for (const eventId of eventIds) {
    results.push(await backfillEvent(eventId))
  }
  const totals = results.reduce(
    (acc, r) => ({
      hallsCreated: acc.hallsCreated + r.hallsCreated,
      sessionsLinked: acc.sessionsLinked + r.sessionsLinked,
      coordinatorsLinked: acc.coordinatorsLinked + r.coordinatorsLinked,
    }),
    { hallsCreated: 0, sessionsLinked: 0, coordinatorsLinked: 0 }
  )
  console.log(
    `\nTotal: ${totals.hallsCreated} halls, ${totals.sessionsLinked} sessions linked, ${totals.coordinatorsLinked} hall coordinators linked across ${eventIds.length} events`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
