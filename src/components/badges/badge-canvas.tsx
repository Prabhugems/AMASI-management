"use client"

import { BADGE_SIZES, type BadgeTemplate } from "@/lib/badge-template-types"
import { BadgeElementView, type BadgeRenderMode } from "./badge-element-view"
import type { BadgeRegistrationLike, BadgeEventLike } from "@/lib/badge-placeholders"

export interface BadgeCanvasProps {
  template: BadgeTemplate
  mode: BadgeRenderMode
  registration?: BadgeRegistrationLike
  event?: BadgeEventLike
  scale?: number
}

export function BadgeCanvas({ template, mode, registration, event, scale = 1 }: BadgeCanvasProps) {
  const size = BADGE_SIZES[template.size] || BADGE_SIZES["4x3"]
  return (
    <div className="relative" style={{
      width: size.width * scale,
      height: size.height * scale,
      backgroundColor: template.backgroundColor,
    }}>
      {template.backgroundImageUrl && (
        <img src={template.backgroundImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ zIndex: 0 }} />
      )}
      {template.elements.slice().sort((a, b) => a.zIndex - b.zIndex).map((element) => {
        const rotation = element.rotation || 0
        return (
          <div key={element.id} className="absolute" style={{
            left: element.x * scale,
            top: element.y * scale,
            width: element.width * scale,
            height: element.height * scale,
            zIndex: element.zIndex,
            opacity: (element.opacity ?? 100) / 100,
            transform: rotation ? `rotate(${rotation}deg)` : undefined,
            transformOrigin: "center center",
          }}>
            <BadgeElementView element={element} mode={mode} registration={registration} event={event} scale={scale} />
          </div>
        )
      })}
    </div>
  )
}
