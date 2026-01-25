"use client"

import { useEffect } from "react"

type InsertChatProps = {
  userEmail?: string
  userFirstName?: string
  userLastName?: string
  metadata?: Record<string, string>
}

/**
 * InsertChat AI Chatbot Component
 * Adds a floating chat bubble for user assistance
 */
export function InsertChat({
  userEmail = "",
  userFirstName = "",
  userLastName = "",
  metadata = {},
}: InsertChatProps) {
  useEffect(() => {
    // Set InsertChat configuration
    const w = window as any
    w.ICG_BOT_ID = "3e5bf240-a728-4880-a0a3-a339807ca3a5"
    w.ICG_BOT_TYPE = "bubble"
    w.ICG_BOT_HEIGHT = 750
    w.ICG_BOT_BG_COLOR = "#fff"
    w.ICG_BOT_AUTOFOCUS = false
    w.ICG_BOT_OVERRIDE_OPENER = ""
    w.ICG_USER_ID = ""
    w.ICG_USER_EMAIL = userEmail
    w.ICG_USER_FIRSTNAME = userFirstName
    w.ICG_USER_LASTNAME = userLastName
    w.ICG_USER_TAGS = []
    w.ICG_USER_METADATA = metadata

    // Load the chatbot script if not already loaded
    if (!document.getElementById("insertchat-script")) {
      const script = document.createElement("script")
      script.id = "insertchat-script"
      script.src = "https://app.insertchat.com/widgets/chatbot.js"
      script.async = true
      document.body.appendChild(script)
    }

    // Cleanup on unmount
    return () => {
      // Remove chat widget elements
      const chatWidget = document.querySelector("[data-insertchat]")
      if (chatWidget) chatWidget.remove()

      const chatFrame = document.querySelector('iframe[src*="insertchat"]')
      if (chatFrame) chatFrame.remove()
    }
  }, [userEmail, userFirstName, userLastName, metadata])

  // This component doesn't render anything visible
  // The chat bubble is injected by the InsertChat script
  return null
}
