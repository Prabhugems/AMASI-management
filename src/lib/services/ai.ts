import Anthropic from "@anthropic-ai/sdk"

let client: Anthropic | null = null

/** Get singleton Anthropic SDK client */
export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured")
    }
    client = new Anthropic({ apiKey })
  }
  return client
}

/** Check if AI features are available */
export function isAIEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY?.trim()
}
