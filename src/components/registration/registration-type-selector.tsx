"use client"

import { useState } from "react"
import { User, Users } from "lucide-react"
import { cn } from "@/lib/utils"

interface RegistrationTypeSelectorProps {
  allowBuyers: boolean
  onSelect: (type: "individual" | "group") => void
  selectedType?: "individual" | "group" | null
}

export function RegistrationTypeSelector({
  allowBuyers,
  onSelect,
  selectedType = null,
}: RegistrationTypeSelectorProps) {
  const [selected, setSelected] = useState<"individual" | "group" | null>(selectedType)

  // If buyers not allowed, don't show selector - individual is the only option
  if (!allowBuyers) {
    return null
  }

  const handleSelect = (type: "individual" | "group") => {
    setSelected(type)
    onSelect(type)
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900">
          How would you like to register?
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Choose the registration type that best suits your needs
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
        {/* Individual Option */}
        <button
          type="button"
          onClick={() => handleSelect("individual")}
          className={cn(
            "relative p-6 rounded-xl border-2 transition-all duration-200 text-left",
            "hover:border-emerald-300 hover:shadow-md",
            selected === "individual"
              ? "border-emerald-600 bg-emerald-50 shadow-md"
              : "border-gray-200 bg-white"
          )}
        >
          {/* Selected indicator */}
          {selected === "individual" && (
            <div className="absolute top-3 right-3 w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}

          <div
            className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center mb-4",
              selected === "individual" ? "bg-emerald-100" : "bg-gray-100"
            )}
          >
            <User
              className={cn(
                "w-7 h-7",
                selected === "individual" ? "text-emerald-600" : "text-gray-600"
              )}
            />
          </div>

          <h3 className="font-semibold text-lg text-gray-900 mb-2">
            Individual Registration
          </h3>
          <p className="text-sm text-gray-500">
            Register yourself only. Complete the form and payment for a single attendee.
          </p>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <ul className="text-xs text-gray-500 space-y-1">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                One person, one ticket
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                Individual payment
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                Receive your own registration ID
              </li>
            </ul>
          </div>
        </button>

        {/* Group Option */}
        <button
          type="button"
          onClick={() => handleSelect("group")}
          className={cn(
            "relative p-6 rounded-xl border-2 transition-all duration-200 text-left",
            "hover:border-emerald-300 hover:shadow-md",
            selected === "group"
              ? "border-emerald-600 bg-emerald-50 shadow-md"
              : "border-gray-200 bg-white"
          )}
        >
          {/* Selected indicator */}
          {selected === "group" && (
            <div className="absolute top-3 right-3 w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}

          {/* Popular badge */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
              For Institutes
            </span>
          </div>

          <div
            className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center mb-4",
              selected === "group" ? "bg-emerald-100" : "bg-gray-100"
            )}
          >
            <Users
              className={cn(
                "w-7 h-7",
                selected === "group" ? "text-emerald-600" : "text-gray-600"
              )}
            />
          </div>

          <h3 className="font-semibold text-lg text-gray-900 mb-2">
            Group Booking
          </h3>
          <p className="text-sm text-gray-500">
            Register multiple people at once. Perfect for hospitals, institutes, or departments.
          </p>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <ul className="text-xs text-gray-500 space-y-1">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                Register multiple attendees
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                Single combined payment
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                Each attendee gets own registration ID
              </li>
            </ul>
          </div>
        </button>
      </div>
    </div>
  )
}
