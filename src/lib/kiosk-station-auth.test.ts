import { describe, it, expect } from "vitest"
import { newStationToken, hashStationToken } from "./kiosk-station-auth"

describe("kiosk-station-auth", () => {
  it("generates a 48-char hex token", () => {
    const token = newStationToken()
    expect(token).toMatch(/^[0-9a-f]{48}$/)
  })

  it("generates a different token on each call", () => {
    expect(newStationToken()).not.toBe(newStationToken())
  })

  it("hashes deterministically -- the same token always hashes the same way", () => {
    const token = newStationToken()
    expect(hashStationToken(token)).toBe(hashStationToken(token))
  })

  it("hash is a 64-char hex SHA-256 digest, and never equals the plaintext", () => {
    const token = newStationToken()
    const hash = hashStationToken(token)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).not.toBe(token)
  })
})
