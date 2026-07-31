#!/usr/bin/env node
/**
 * Agenda Builder Phase 1 backfill: matches sessions.specialty_track (free
 * text) against existing tracks.name (case-insensitive) within the same
 * event, creating a new track row when nothing matches, and links
 * sessions.track_id.
 *
 * Read-only by default (dry run). Pass --commit to actually write.
 * --commit requires supabase/migrations/20260730_agenda_builder_tracks.sql
 * to already be applied.
 *
 * Usage:
 *   node scripts/agenda-backfill-tracks.mjs
 *   node scripts/agenda-backfill-tracks.mjs --event <id>
 *   node scripts/agenda-backfill-tracks.mjs --commit
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
    supabase.from('sessions').select('id, specialty_track, track_id').eq('event_id', eventId).not('specialty_track', 'is', null)
  )
  if (!sessions.length) return { eventId, tracksCreated: 0, sessionsLinked: 0 }

  const distinctTrackNames = [...new Set(sessions.map((s) => s.specialty_track.trim()).filter(Boolean))]

  const existingTracks = await fetchAllPages(supabase.from('tracks').select('id, name').eq('event_id', eventId))

  const lowerNameToTrackId = new Map(existingTracks.map((t) => [t.name.toLowerCase(), t.id]))
  const namesToCreate = distinctTrackNames.filter((name) => !lowerNameToTrackId.has(name.toLowerCase()))

  console.log(`[${eventId}] ${distinctTrackNames.length} distinct specialty_track values, ${namesToCreate.length} to create`)

  // Dry-run preview only: without this, sessionsToLink below would always
  // be empty on a fresh event, since lowerNameToTrackId only gets real IDs
  // when commit is true. The placeholder never reaches a database write --
  // the write loop below is itself gated on `if (commit)`. See Task 6's
  // fix round 1 for the identical bug found in the halls backfill script.
  if (!commit) {
    for (const name of namesToCreate) lowerNameToTrackId.set(name.toLowerCase(), "preview-only")
  }

  if (commit && namesToCreate.length) {
    const { data: created, error: createError } = await supabase
      .from('tracks')
      .insert(namesToCreate.map((name) => ({ event_id: eventId, name })))
      .select('id, name')
    if (createError) throw createError
    for (const t of created) lowerNameToTrackId.set(t.name.toLowerCase(), t.id)
  }

  const sessionsToLink = sessions.filter(
    (s) => !s.track_id && s.specialty_track && lowerNameToTrackId.has(s.specialty_track.trim().toLowerCase())
  )
  console.log(`[${eventId}] ${sessionsToLink.length} sessions to link to a track_id`)

  if (commit) {
    for (const session of sessionsToLink) {
      const trackId = lowerNameToTrackId.get(session.specialty_track.trim().toLowerCase())
      const { error: updateError } = await supabase
        .from('sessions')
        .update({ track_id: trackId })
        .eq('id', session.id)
      if (updateError) throw updateError
    }
  }

  return { eventId, tracksCreated: namesToCreate.length, sessionsLinked: sessionsToLink.length }
}

async function main() {
  console.log(commit ? 'Running in COMMIT mode' : 'Running in DRY-RUN mode (pass --commit to write)')
  const eventIds = await getEventIds()
  const results = []
  for (const eventId of eventIds) {
    results.push(await backfillEvent(eventId))
  }
  const totals = results.reduce(
    (acc, r) => ({ tracksCreated: acc.tracksCreated + r.tracksCreated, sessionsLinked: acc.sessionsLinked + r.sessionsLinked }),
    { tracksCreated: 0, sessionsLinked: 0 }
  )
  console.log(`\nTotal: ${totals.tracksCreated} tracks, ${totals.sessionsLinked} sessions linked across ${eventIds.length} events`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
