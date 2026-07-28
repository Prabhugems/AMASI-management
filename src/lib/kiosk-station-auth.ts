import crypto from "crypto"

// One shared implementation for every route that mints or verifies a
// kiosk_stations access token (kiosk-stations CRUD, the access-token rotate
// endpoint, and the station_token auth path on /api/kiosk/delegates and
// /api/kiosk/checkin) -- not four copies.

// 48-char CSPRNG hex token -- twice checkin_lists'/print_stations' 24-char
// convention, since this credential is the sole authenticator for a public,
// no-login device route (/kiosk-station/[token]), not a secondary check
// layered on top of dashboard auth.
export function newStationToken(): string {
  return crypto.randomBytes(24).toString("hex")
}

// SHA-256 -- sufficient for a high-entropy random token (unlike a short PIN,
// this needs no brute-force-resistant KDF like scrypt). Only the hash is
// ever persisted; the plaintext token is returned to the caller exactly
// once, at mint time, and never stored anywhere retrievable again.
export function hashStationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}
