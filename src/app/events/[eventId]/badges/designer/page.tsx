"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Rnd } from "react-rnd"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Type,
  QrCode,
  Image as ImageIcon,
  Trash2,
  Plus,
  Grid3X3,
  Eye,
  ChevronLeft,
  ChevronRight,
  Save,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Upload,
  Download,
  Loader2,
  FolderOpen,
  Square,
  MousePointer,
  Copy,
  Minus,
  Undo2,
  Redo2,
  Layers,
  ArrowUpToLine,
  ArrowDownToLine,
  Lock,
  Unlock,
  Clipboard,
  GripVertical,
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
  AlignStartVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignEndHorizontal,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  EyeOff,
  Italic,
  Palette,
  LayoutGrid,
  Sparkles,
  User,
  Hash,
  Ticket,
  Building2,
  Briefcase,
  Calendar,
  MapPin,
  Mail,
  Phone,
  Lightbulb,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Circle,
  Triangle,
  RectangleHorizontal,
  Barcode,
  UserCircle,
  FileImage,
  Wand2,
  CheckCircle,
  Package,
  AlertTriangle,
} from "lucide-react"
import JsBarcode from "jsbarcode"
import { cn } from "@/lib/utils"
import QRCode from "qrcode"

// Badge sizes
const BADGE_SIZES: Record<string, { width: number; height: number; label: string }> = {
  "4x3": { width: 384, height: 288, label: '4" × 3"' },
  "3x4": { width: 288, height: 384, label: '3" × 4"' },
  "4x6": { width: 384, height: 576, label: '4" × 6"' },
  "3.5x2": { width: 336, height: 192, label: '3.5" × 2"' },
  A6: { width: 397, height: 559, label: "A6" },
}

// Predefined fields with Lucide icons
const PREDEFINED_FIELDS: { key: string; label: string; icon: any; placeholder: string; defaultSize: { w: number; h: number }; fontSize: number; fontWeight: "normal" | "bold" }[] = [
  { key: "name", label: "Full Name", icon: User, placeholder: "{{name}}", defaultSize: { w: 280, h: 40 }, fontSize: 24, fontWeight: "bold" },
  { key: "registration_number", label: "Reg. Number", icon: Hash, placeholder: "{{registration_number}}", defaultSize: { w: 150, h: 30 }, fontSize: 16, fontWeight: "bold" },
  { key: "ticket_type", label: "Ticket Type", icon: Ticket, placeholder: "{{ticket_type}}", defaultSize: { w: 250, h: 25 }, fontSize: 14, fontWeight: "normal" },
  { key: "institution", label: "Institution", icon: Building2, placeholder: "{{institution}}", defaultSize: { w: 200, h: 25 }, fontSize: 14, fontWeight: "normal" },
  { key: "designation", label: "Designation", icon: Briefcase, placeholder: "{{designation}}", defaultSize: { w: 180, h: 25 }, fontSize: 14, fontWeight: "normal" },
  { key: "email", label: "Email", icon: Mail, placeholder: "{{email}}", defaultSize: { w: 200, h: 22 }, fontSize: 12, fontWeight: "normal" },
  { key: "phone", label: "Phone", icon: Phone, placeholder: "{{phone}}", defaultSize: { w: 150, h: 22 }, fontSize: 12, fontWeight: "normal" },
  { key: "event_name", label: "Event Name", icon: MapPin, placeholder: "{{event_name}}", defaultSize: { w: 250, h: 30 }, fontSize: 18, fontWeight: "bold" },
  { key: "event_date", label: "Event Date", icon: Calendar, placeholder: "{{event_date}}", defaultSize: { w: 200, h: 25 }, fontSize: 14, fontWeight: "normal" },
  { key: "addons", label: "Addons", icon: Package, placeholder: "{{addons}}", defaultSize: { w: 200, h: 25 }, fontSize: 12, fontWeight: "normal" },
]

const FONT_OPTIONS = [
  // System fonts
  { value: "Arial, sans-serif", label: "Arial", isGoogle: false },
  { value: "Helvetica, sans-serif", label: "Helvetica", isGoogle: false },
  { value: "Georgia, serif", label: "Georgia", isGoogle: false },
  { value: "Times New Roman, serif", label: "Times New Roman", isGoogle: false },
  { value: "Verdana, sans-serif", label: "Verdana", isGoogle: false },
  // Google Fonts
  { value: "'Roboto', sans-serif", label: "Roboto", isGoogle: true },
  { value: "'Open Sans', sans-serif", label: "Open Sans", isGoogle: true },
  { value: "'Lato', sans-serif", label: "Lato", isGoogle: true },
  { value: "'Montserrat', sans-serif", label: "Montserrat", isGoogle: true },
  { value: "'Poppins', sans-serif", label: "Poppins", isGoogle: true },
  { value: "'Playfair Display', serif", label: "Playfair Display", isGoogle: true },
  { value: "'Merriweather', serif", label: "Merriweather", isGoogle: true },
  { value: "'Raleway', sans-serif", label: "Raleway", isGoogle: true },
  { value: "'Oswald', sans-serif", label: "Oswald", isGoogle: true },
  { value: "'Source Sans Pro', sans-serif", label: "Source Sans Pro", isGoogle: true },
]

// Pre-built badge templates - Both 4x6 (384x576) and 4x3 (384x288) versions
// Professional templates inspired by real conference badges
const PRE_BUILT_TEMPLATES: { name: string; description: string; size: string; elements: Omit<BadgeElement, "id">[] }[] = [
  {
    name: "Professional",
    description: "Clean corporate design",
    size: "4x6",
    elements: [
      // White background
      { type: "shape", x: 0, y: 0, width: 384, height: 576, backgroundColor: "#ffffff", shapeType: "rectangle", zIndex: 0 },
      // Blue header band
      { type: "shape", x: 0, y: 0, width: 384, height: 100, backgroundColor: "#1e40af", shapeType: "rectangle", zIndex: 1 },
      // Event branding
      { type: "text", x: 20, y: 30, width: 344, height: 30, content: "{{event_name}}", fontSize: 18, fontWeight: "bold", color: "#ffffff", align: "center", zIndex: 2 },
      { type: "text", x: 20, y: 62, width: 344, height: 22, content: "{{event_date}}", fontSize: 12, color: "#93c5fd", align: "center", zIndex: 2 },
      // Name - Large and prominent
      { type: "text", x: 20, y: 130, width: 344, height: 65, content: "{{name}}", fontSize: 36, fontWeight: "bold", color: "#1e293b", align: "center", zIndex: 1 },
      // Credentials
      { type: "text", x: 20, y: 205, width: 344, height: 26, content: "{{designation}}", fontSize: 16, color: "#1e40af", align: "center", zIndex: 1 },
      { type: "text", x: 20, y: 235, width: 344, height: 24, content: "{{institution}}", fontSize: 14, color: "#64748b", align: "center", zIndex: 1 },
      // Ticket type badge
      { type: "shape", x: 112, y: 280, width: 160, height: 38, backgroundColor: "#1e40af", borderRadius: 19, shapeType: "rounded", zIndex: 1 },
      { type: "text", x: 112, y: 288, width: 160, height: 24, content: "{{ticket_type}}", fontSize: 14, fontWeight: "bold", color: "#ffffff", align: "center", textCase: "uppercase", zIndex: 2 },
      // QR Code
      { type: "qr_code", x: 117, y: 345, width: 150, height: 150, content: "{{registration_number}}", zIndex: 1 },
      // Registration number
      { type: "text", x: 20, y: 510, width: 344, height: 22, content: "{{registration_number}}", fontSize: 14, fontWeight: "bold", color: "#1e40af", align: "center", zIndex: 1 },
      // Footer accent
      { type: "shape", x: 0, y: 550, width: 384, height: 26, backgroundColor: "#1e40af", shapeType: "rectangle", zIndex: 1 },
    ]
  },
  {
    name: "Modern",
    description: "Bold gradient header",
    size: "4x6",
    elements: [
      // White background
      { type: "shape", x: 0, y: 0, width: 384, height: 576, backgroundColor: "#fafafa", shapeType: "rectangle", zIndex: 0 },
      // Purple header
      { type: "shape", x: 0, y: 0, width: 384, height: 120, backgroundColor: "#7c3aed", shapeType: "rectangle", zIndex: 1 },
      // Accent line
      { type: "shape", x: 0, y: 120, width: 384, height: 4, backgroundColor: "#a78bfa", shapeType: "rectangle", zIndex: 2 },
      // Event info
      { type: "text", x: 20, y: 35, width: 344, height: 28, content: "{{event_name}}", fontSize: 17, fontWeight: "bold", color: "#ffffff", align: "center", zIndex: 2 },
      { type: "text", x: 20, y: 68, width: 344, height: 22, content: "{{event_date}}", fontSize: 12, color: "#c4b5fd", align: "center", zIndex: 2 },
      // Ticket pill
      { type: "shape", x: 137, y: 90, width: 110, height: 24, backgroundColor: "#a78bfa", borderRadius: 12, shapeType: "rounded", zIndex: 2 },
      { type: "text", x: 137, y: 94, width: 110, height: 18, content: "{{ticket_type}}", fontSize: 11, fontWeight: "bold", color: "#ffffff", align: "center", textCase: "uppercase", zIndex: 3 },
      // Name
      { type: "text", x: 20, y: 150, width: 344, height: 65, content: "{{name}}", fontSize: 34, fontWeight: "bold", color: "#1f2937", align: "center", zIndex: 1 },
      // Info
      { type: "text", x: 20, y: 225, width: 344, height: 26, content: "{{designation}}", fontSize: 15, color: "#7c3aed", align: "center", zIndex: 1 },
      { type: "text", x: 20, y: 255, width: 344, height: 24, content: "{{institution}}", fontSize: 13, color: "#6b7280", align: "center", zIndex: 1 },
      // QR Section
      { type: "qr_code", x: 117, y: 310, width: 150, height: 150, content: "{{registration_number}}", zIndex: 1 },
      // ID
      { type: "text", x: 20, y: 475, width: 344, height: 22, content: "{{registration_number}}", fontSize: 14, fontWeight: "bold", color: "#7c3aed", align: "center", zIndex: 1 },
      // Footer
      { type: "shape", x: 0, y: 520, width: 384, height: 56, backgroundColor: "#f3f4f6", shapeType: "rectangle", zIndex: 1 },
      { type: "shape", x: 0, y: 570, width: 384, height: 6, backgroundColor: "#7c3aed", shapeType: "rectangle", zIndex: 2 },
    ]
  },
  {
    name: "Minimal",
    description: "Simple and elegant",
    size: "4x6",
    elements: [
      // Clean white background
      { type: "shape", x: 0, y: 0, width: 384, height: 576, backgroundColor: "#ffffff", shapeType: "rectangle", zIndex: 0 },
      // Thin top accent
      { type: "shape", x: 0, y: 0, width: 384, height: 6, backgroundColor: "#111827", shapeType: "rectangle", zIndex: 1 },
      // Event name - small at top
      { type: "text", x: 20, y: 30, width: 344, height: 22, content: "{{event_name}}", fontSize: 12, fontWeight: "bold", color: "#6b7280", align: "center", textCase: "uppercase", zIndex: 1 },
      { type: "text", x: 20, y: 52, width: 344, height: 18, content: "{{event_date}}", fontSize: 11, color: "#9ca3af", align: "center", zIndex: 1 },
      // Name - Large and central
      { type: "text", x: 20, y: 110, width: 344, height: 75, content: "{{name}}", fontSize: 38, fontWeight: "bold", color: "#111827", align: "center", zIndex: 1 },
      // Divider line
      { type: "line", x: 142, y: 195, width: 100, height: 2, color: "#e5e7eb", zIndex: 1 },
      // Credentials
      { type: "text", x: 20, y: 215, width: 344, height: 26, content: "{{designation}}", fontSize: 15, color: "#374151", align: "center", zIndex: 1 },
      { type: "text", x: 20, y: 245, width: 344, height: 24, content: "{{institution}}", fontSize: 13, color: "#6b7280", align: "center", zIndex: 1 },
      // Simple ticket type
      { type: "text", x: 20, y: 290, width: 344, height: 22, content: "{{ticket_type}}", fontSize: 13, fontWeight: "bold", color: "#111827", align: "center", textCase: "uppercase", zIndex: 1 },
      // QR Code
      { type: "qr_code", x: 117, y: 340, width: 150, height: 150, content: "{{registration_number}}", zIndex: 1 },
      // Registration
      { type: "text", x: 20, y: 510, width: 344, height: 22, content: "{{registration_number}}", fontSize: 12, color: "#6b7280", align: "center", zIndex: 1 },
      // Bottom accent
      { type: "shape", x: 0, y: 570, width: 384, height: 6, backgroundColor: "#111827", shapeType: "rectangle", zIndex: 1 },
    ]
  },
  {
    name: "Event Badge",
    description: "With event details",
    size: "4x6",
    elements: [
      // Background
      { type: "shape", x: 0, y: 0, width: 384, height: 576, backgroundColor: "#ffffff", shapeType: "rectangle", zIndex: 0 },
      // Green header
      { type: "shape", x: 0, y: 0, width: 384, height: 95, backgroundColor: "#059669", shapeType: "rectangle", zIndex: 1 },
      // Event name
      { type: "text", x: 20, y: 25, width: 344, height: 28, content: "{{event_name}}", fontSize: 17, fontWeight: "bold", color: "#ffffff", align: "center", zIndex: 2 },
      { type: "text", x: 20, y: 55, width: 344, height: 22, content: "{{event_date}}", fontSize: 12, color: "#a7f3d0", align: "center", zIndex: 2 },
      // Ticket type bar
      { type: "shape", x: 0, y: 95, width: 384, height: 35, backgroundColor: "#047857", shapeType: "rectangle", zIndex: 1 },
      { type: "text", x: 20, y: 102, width: 344, height: 22, content: "{{ticket_type}}", fontSize: 13, fontWeight: "bold", color: "#ffffff", align: "center", textCase: "uppercase", zIndex: 2 },
      // Name
      { type: "text", x: 20, y: 160, width: 344, height: 65, content: "{{name}}", fontSize: 34, fontWeight: "bold", color: "#1f2937", align: "center", zIndex: 1 },
      // Credentials
      { type: "text", x: 20, y: 235, width: 344, height: 26, content: "{{designation}}", fontSize: 15, color: "#059669", align: "center", zIndex: 1 },
      { type: "text", x: 20, y: 265, width: 344, height: 24, content: "{{institution}}", fontSize: 13, color: "#6b7280", align: "center", zIndex: 1 },
      // QR Code area
      { type: "shape", x: 102, y: 315, width: 180, height: 180, backgroundColor: "#f0fdf4", borderRadius: 10, shapeType: "rounded", zIndex: 1 },
      { type: "qr_code", x: 117, y: 330, width: 150, height: 150, content: "{{registration_number}}", zIndex: 2 },
      // ID
      { type: "text", x: 20, y: 515, width: 344, height: 22, content: "{{registration_number}}", fontSize: 14, fontWeight: "bold", color: "#059669", align: "center", zIndex: 1 },
      // Footer
      { type: "shape", x: 0, y: 555, width: 384, height: 21, backgroundColor: "#059669", shapeType: "rectangle", zIndex: 1 },
    ]
  },
  {
    name: "Medical Conference",
    description: "Healthcare & medical events",
    size: "4x6",
    elements: [
      // White background
      { type: "shape", x: 0, y: 0, width: 384, height: 576, backgroundColor: "#ffffff", shapeType: "rectangle", zIndex: 0 },
      // Teal accent bar
      { type: "shape", x: 0, y: 0, width: 384, height: 8, backgroundColor: "#0d9488", shapeType: "rectangle", zIndex: 1 },
      // Light teal header area
      { type: "shape", x: 0, y: 8, width: 384, height: 85, backgroundColor: "#f0fdfa", shapeType: "rectangle", zIndex: 1 },
      // Event info
      { type: "text", x: 20, y: 28, width: 344, height: 28, content: "{{event_name}}", fontSize: 16, fontWeight: "bold", color: "#0d9488", align: "center", zIndex: 2 },
      { type: "text", x: 20, y: 58, width: 344, height: 20, content: "{{event_date}}", fontSize: 11, color: "#64748b", align: "center", zIndex: 2 },
      // Name section
      { type: "text", x: 20, y: 120, width: 344, height: 60, content: "{{name}}", fontSize: 32, fontWeight: "bold", color: "#0f172a", align: "center", zIndex: 1 },
      // Credentials with medical styling
      { type: "text", x: 20, y: 190, width: 344, height: 26, content: "{{designation}}", fontSize: 15, color: "#0d9488", align: "center", zIndex: 1 },
      { type: "text", x: 20, y: 220, width: 344, height: 24, content: "{{institution}}", fontSize: 13, color: "#64748b", align: "center", zIndex: 1 },
      // Category pill
      { type: "shape", x: 112, y: 268, width: 160, height: 36, backgroundColor: "#0d9488", borderRadius: 18, shapeType: "rounded", zIndex: 1 },
      { type: "text", x: 112, y: 276, width: 160, height: 22, content: "{{ticket_type}}", fontSize: 13, fontWeight: "bold", color: "#ffffff", align: "center", textCase: "uppercase", zIndex: 2 },
      // QR Code area
      { type: "shape", x: 102, y: 325, width: 180, height: 180, backgroundColor: "#f8fafc", borderRadius: 8, shapeType: "rounded", zIndex: 1 },
      { type: "qr_code", x: 117, y: 340, width: 150, height: 150, content: "{{registration_number}}", zIndex: 2 },
      // Registration info
      { type: "text", x: 20, y: 520, width: 344, height: 22, content: "{{registration_number}}", fontSize: 14, fontWeight: "bold", color: "#0d9488", align: "center", zIndex: 1 },
      // Bottom accent
      { type: "shape", x: 0, y: 555, width: 384, height: 21, backgroundColor: "#0d9488", shapeType: "rectangle", zIndex: 1 },
    ]
  },
  {
    name: "Tech Summit",
    description: "Dark theme for tech events",
    size: "4x6",
    elements: [
      // Dark background
      { type: "shape", x: 0, y: 0, width: 384, height: 576, backgroundColor: "#18181b", shapeType: "rectangle", zIndex: 0 },
      // Accent lines
      { type: "shape", x: 0, y: 0, width: 384, height: 4, backgroundColor: "#8b5cf6", shapeType: "rectangle", zIndex: 1 },
      { type: "shape", x: 0, y: 572, width: 384, height: 4, backgroundColor: "#06b6d4", shapeType: "rectangle", zIndex: 1 },
      // Event name
      { type: "text", x: 20, y: 30, width: 344, height: 24, content: "{{event_name}}", fontSize: 13, fontWeight: "bold", color: "#8b5cf6", align: "center", textCase: "uppercase", zIndex: 1 },
      { type: "text", x: 20, y: 55, width: 344, height: 20, content: "{{event_date}}", fontSize: 11, color: "#71717a", align: "center", zIndex: 1 },
      // Name
      { type: "text", x: 20, y: 100, width: 344, height: 65, content: "{{name}}", fontSize: 34, fontWeight: "bold", color: "#fafafa", align: "center", zIndex: 1 },
      // Role
      { type: "text", x: 20, y: 175, width: 344, height: 26, content: "{{designation}}", fontSize: 15, color: "#06b6d4", align: "center", zIndex: 1 },
      { type: "text", x: 20, y: 205, width: 344, height: 24, content: "{{institution}}", fontSize: 13, color: "#71717a", align: "center", zIndex: 1 },
      // Category with border
      { type: "shape", x: 107, y: 255, width: 170, height: 40, backgroundColor: "#27272a", borderRadius: 8, borderWidth: 1, borderColor: "#8b5cf6", shapeType: "rounded", zIndex: 1 },
      { type: "text", x: 107, y: 265, width: 170, height: 24, content: "{{ticket_type}}", fontSize: 14, fontWeight: "bold", color: "#8b5cf6", align: "center", textCase: "uppercase", zIndex: 2 },
      // QR in white box
      { type: "shape", x: 102, y: 320, width: 180, height: 180, backgroundColor: "#ffffff", borderRadius: 12, shapeType: "rounded", zIndex: 1 },
      { type: "qr_code", x: 117, y: 335, width: 150, height: 150, content: "{{registration_number}}", zIndex: 2 },
      // ID
      { type: "text", x: 20, y: 520, width: 344, height: 22, content: "{{registration_number}}", fontSize: 14, fontWeight: "bold", color: "#06b6d4", align: "center", zIndex: 1 },
    ]
  },
  {
    name: "Academic",
    description: "Classic scholarly design",
    size: "4x6",
    elements: [
      // Cream background
      { type: "shape", x: 0, y: 0, width: 384, height: 576, backgroundColor: "#fefce8", shapeType: "rectangle", zIndex: 0 },
      // Classic border
      { type: "shape", x: 12, y: 12, width: 360, height: 552, backgroundColor: "transparent", borderWidth: 2, borderColor: "#92400e", shapeType: "rectangle", zIndex: 1 },
      // Event name in elegant style
      { type: "text", x: 30, y: 35, width: 324, height: 28, content: "{{event_name}}", fontSize: 15, fontWeight: "bold", color: "#92400e", align: "center", zIndex: 2 },
      { type: "line", x: 92, y: 70, width: 200, height: 1, color: "#d97706", zIndex: 2 },
      { type: "text", x: 30, y: 80, width: 324, height: 20, content: "{{event_date}}", fontSize: 11, color: "#b45309", align: "center", zIndex: 2 },
      // Name
      { type: "text", x: 30, y: 120, width: 324, height: 60, content: "{{name}}", fontSize: 30, fontWeight: "bold", color: "#451a03", align: "center", zIndex: 2 },
      // Academic title
      { type: "text", x: 30, y: 190, width: 324, height: 26, content: "{{designation}}", fontSize: 15, fontStyle: "italic", color: "#92400e", align: "center", zIndex: 2 },
      { type: "text", x: 30, y: 220, width: 324, height: 24, content: "{{institution}}", fontSize: 13, color: "#a16207", align: "center", zIndex: 2 },
      // Category in classic style
      { type: "shape", x: 112, y: 270, width: 160, height: 36, backgroundColor: "#92400e", borderRadius: 4, shapeType: "rounded", zIndex: 2 },
      { type: "text", x: 112, y: 278, width: 160, height: 22, content: "{{ticket_type}}", fontSize: 13, fontWeight: "bold", color: "#fef3c7", align: "center", textCase: "uppercase", zIndex: 3 },
      // QR Code
      { type: "qr_code", x: 117, y: 330, width: 150, height: 150, content: "{{registration_number}}", zIndex: 2 },
      // Registration
      { type: "text", x: 30, y: 500, width: 324, height: 22, content: "{{registration_number}}", fontSize: 13, fontWeight: "bold", color: "#92400e", align: "center", zIndex: 2 },
      { type: "line", x: 92, y: 535, width: 200, height: 1, color: "#d97706", zIndex: 2 },
    ]
  },
  {
    name: "Creative",
    description: "Colorful artistic design",
    size: "4x6",
    elements: [
      // White background
      { type: "shape", x: 0, y: 0, width: 384, height: 576, backgroundColor: "#ffffff", shapeType: "rectangle", zIndex: 0 },
      // Colorful header
      { type: "shape", x: 0, y: 0, width: 384, height: 90, backgroundColor: "#d946ef", shapeType: "rectangle", zIndex: 1 },
      // Pink accent strip
      { type: "shape", x: 0, y: 90, width: 384, height: 8, backgroundColor: "#f0abfc", shapeType: "rectangle", zIndex: 2 },
      // Event info
      { type: "text", x: 20, y: 28, width: 344, height: 28, content: "{{event_name}}", fontSize: 17, fontWeight: "bold", color: "#ffffff", align: "center", zIndex: 2 },
      { type: "text", x: 20, y: 58, width: 344, height: 22, content: "{{event_date}}", fontSize: 12, color: "#f5d0fe", align: "center", zIndex: 2 },
      // Name
      { type: "text", x: 20, y: 125, width: 344, height: 65, content: "{{name}}", fontSize: 34, fontWeight: "bold", color: "#1f2937", align: "center", zIndex: 1 },
      // Credentials
      { type: "text", x: 20, y: 200, width: 344, height: 26, content: "{{designation}}", fontSize: 15, color: "#d946ef", align: "center", zIndex: 1 },
      { type: "text", x: 20, y: 230, width: 344, height: 24, content: "{{institution}}", fontSize: 13, color: "#6b7280", align: "center", zIndex: 1 },
      // Ticket type with creative shape
      { type: "shape", x: 107, y: 275, width: 170, height: 40, backgroundColor: "#d946ef", borderRadius: 20, shapeType: "rounded", zIndex: 1 },
      { type: "text", x: 107, y: 285, width: 170, height: 24, content: "{{ticket_type}}", fontSize: 13, fontWeight: "bold", color: "#ffffff", align: "center", textCase: "uppercase", zIndex: 2 },
      // QR with colored border
      { type: "shape", x: 99, y: 335, width: 186, height: 186, backgroundColor: "#fdf4ff", borderRadius: 12, borderWidth: 3, borderColor: "#d946ef", shapeType: "rounded", zIndex: 1 },
      { type: "qr_code", x: 117, y: 353, width: 150, height: 150, content: "{{registration_number}}", zIndex: 2 },
      // ID
      { type: "text", x: 20, y: 535, width: 344, height: 22, content: "{{registration_number}}", fontSize: 14, fontWeight: "bold", color: "#d946ef", align: "center", zIndex: 1 },
    ]
  },
  {
    name: "Executive",
    description: "Premium luxury feel",
    size: "4x6",
    elements: [
      // Dark elegant background
      { type: "shape", x: 0, y: 0, width: 384, height: 576, backgroundColor: "#1c1917", shapeType: "rectangle", zIndex: 0 },
      // Gold accents
      { type: "shape", x: 0, y: 0, width: 384, height: 5, backgroundColor: "#ca8a04", shapeType: "rectangle", zIndex: 1 },
      { type: "shape", x: 0, y: 571, width: 384, height: 5, backgroundColor: "#ca8a04", shapeType: "rectangle", zIndex: 1 },
      // Event
      { type: "text", x: 20, y: 35, width: 344, height: 24, content: "{{event_name}}", fontSize: 13, fontWeight: "bold", color: "#ca8a04", align: "center", textCase: "uppercase", zIndex: 1 },
      { type: "line", x: 92, y: 70, width: 200, height: 1, color: "#ca8a04", opacity: 50, zIndex: 1 },
      { type: "text", x: 20, y: 80, width: 344, height: 20, content: "{{event_date}}", fontSize: 11, color: "#78716c", align: "center", zIndex: 1 },
      // Name in gold
      { type: "text", x: 20, y: 125, width: 344, height: 60, content: "{{name}}", fontSize: 32, fontWeight: "bold", color: "#fef3c7", align: "center", zIndex: 1 },
      // Title
      { type: "text", x: 20, y: 195, width: 344, height: 26, content: "{{designation}}", fontSize: 15, color: "#ca8a04", align: "center", zIndex: 1 },
      { type: "text", x: 20, y: 225, width: 344, height: 24, content: "{{institution}}", fontSize: 13, color: "#78716c", align: "center", zIndex: 1 },
      // VIP tag
      { type: "shape", x: 132, y: 275, width: 120, height: 36, backgroundColor: "transparent", borderWidth: 2, borderColor: "#ca8a04", borderRadius: 4, shapeType: "rounded", zIndex: 1 },
      { type: "text", x: 132, y: 283, width: 120, height: 22, content: "{{ticket_type}}", fontSize: 13, fontWeight: "bold", color: "#ca8a04", align: "center", textCase: "uppercase", zIndex: 2 },
      // QR with gold frame
      { type: "shape", x: 107, y: 335, width: 170, height: 170, backgroundColor: "#fef3c7", borderRadius: 8, shapeType: "rounded", zIndex: 1 },
      { type: "qr_code", x: 117, y: 345, width: 150, height: 150, content: "{{registration_number}}", zIndex: 2 },
      // ID
      { type: "text", x: 20, y: 525, width: 344, height: 22, content: "{{registration_number}}", fontSize: 13, fontWeight: "bold", color: "#ca8a04", align: "center", zIndex: 1 },
    ]
  },
  {
    name: "Side Banner",
    description: "Vertical accent strip",
    size: "4x6",
    elements: [
      // Background
      { type: "shape", x: 0, y: 0, width: 384, height: 576, backgroundColor: "#f8fafc", shapeType: "rectangle", zIndex: 0 },
      // Left accent strip
      { type: "shape", x: 0, y: 0, width: 20, height: 576, backgroundColor: "#2563eb", shapeType: "rectangle", zIndex: 1 },
      // Event header
      { type: "text", x: 40, y: 30, width: 324, height: 24, content: "{{event_name}}", fontSize: 14, fontWeight: "bold", color: "#2563eb", align: "left", zIndex: 1 },
      { type: "text", x: 40, y: 55, width: 324, height: 18, content: "{{event_date}}", fontSize: 11, color: "#64748b", align: "left", zIndex: 1 },
      // Name
      { type: "text", x: 40, y: 100, width: 324, height: 65, content: "{{name}}", fontSize: 32, fontWeight: "bold", color: "#0f172a", align: "left", zIndex: 1 },
      // Credentials
      { type: "text", x: 40, y: 175, width: 324, height: 26, content: "{{designation}}", fontSize: 15, color: "#2563eb", align: "left", zIndex: 1 },
      { type: "text", x: 40, y: 205, width: 324, height: 24, content: "{{institution}}", fontSize: 13, color: "#64748b", align: "left", zIndex: 1 },
      // Category
      { type: "shape", x: 40, y: 255, width: 140, height: 34, backgroundColor: "#2563eb", borderRadius: 6, shapeType: "rounded", zIndex: 1 },
      { type: "text", x: 40, y: 263, width: 140, height: 22, content: "{{ticket_type}}", fontSize: 12, fontWeight: "bold", color: "#ffffff", align: "center", textCase: "uppercase", zIndex: 2 },
      // QR
      { type: "qr_code", x: 117, y: 320, width: 150, height: 150, content: "{{registration_number}}", zIndex: 1 },
      // ID
      { type: "text", x: 40, y: 490, width: 324, height: 22, content: "{{registration_number}}", fontSize: 14, fontWeight: "bold", color: "#2563eb", align: "left", zIndex: 1 },
      // Bottom accent
      { type: "shape", x: 0, y: 540, width: 384, height: 36, backgroundColor: "#2563eb", shapeType: "rectangle", zIndex: 1 },
    ]
  },
  {
    name: "Dual Tone",
    description: "Two-color split design",
    size: "4x6",
    elements: [
      // White background
      { type: "shape", x: 0, y: 0, width: 384, height: 576, backgroundColor: "#ffffff", shapeType: "rectangle", zIndex: 0 },
      // Top cyan section
      { type: "shape", x: 0, y: 0, width: 384, height: 130, backgroundColor: "#0ea5e9", shapeType: "rectangle", zIndex: 1 },
      // Bottom dark section
      { type: "shape", x: 0, y: 460, width: 384, height: 116, backgroundColor: "#0c4a6e", shapeType: "rectangle", zIndex: 1 },
      // Event info
      { type: "text", x: 20, y: 35, width: 344, height: 28, content: "{{event_name}}", fontSize: 17, fontWeight: "bold", color: "#ffffff", align: "center", zIndex: 2 },
      { type: "text", x: 20, y: 68, width: 344, height: 22, content: "{{event_date}}", fontSize: 12, color: "#bae6fd", align: "center", zIndex: 2 },
      // Ticket type
      { type: "shape", x: 137, y: 95, width: 110, height: 26, backgroundColor: "#0369a1", borderRadius: 13, shapeType: "rounded", zIndex: 2 },
      { type: "text", x: 137, y: 100, width: 110, height: 18, content: "{{ticket_type}}", fontSize: 11, fontWeight: "bold", color: "#ffffff", align: "center", textCase: "uppercase", zIndex: 3 },
      // Name
      { type: "text", x: 20, y: 160, width: 344, height: 60, content: "{{name}}", fontSize: 32, fontWeight: "bold", color: "#0f172a", align: "center", zIndex: 1 },
      // Credentials
      { type: "text", x: 20, y: 230, width: 344, height: 26, content: "{{designation}}", fontSize: 15, color: "#0ea5e9", align: "center", zIndex: 1 },
      { type: "text", x: 20, y: 260, width: 344, height: 24, content: "{{institution}}", fontSize: 13, color: "#64748b", align: "center", zIndex: 1 },
      // QR
      { type: "qr_code", x: 117, y: 305, width: 150, height: 150, content: "{{registration_number}}", zIndex: 1 },
      // ID in footer
      { type: "text", x: 20, y: 490, width: 344, height: 22, content: "{{registration_number}}", fontSize: 14, fontWeight: "bold", color: "#ffffff", align: "center", zIndex: 2 },
      // Scan instructions
      { type: "text", x: 20, y: 520, width: 344, height: 18, content: "Scan QR code for digital badge", fontSize: 10, color: "#7dd3fc", align: "center", zIndex: 2 },
    ]
  },
  {
    name: "Corner Accent",
    description: "Elegant corner design",
    size: "4x6",
    elements: [
      // White background
      { type: "shape", x: 0, y: 0, width: 384, height: 576, backgroundColor: "#ffffff", shapeType: "rectangle", zIndex: 0 },
      // Top-left corner accent
      { type: "shape", x: 0, y: 0, width: 120, height: 8, backgroundColor: "#dc2626", shapeType: "rectangle", zIndex: 1 },
      { type: "shape", x: 0, y: 0, width: 8, height: 120, backgroundColor: "#dc2626", shapeType: "rectangle", zIndex: 1 },
      // Bottom-right corner accent
      { type: "shape", x: 264, y: 568, width: 120, height: 8, backgroundColor: "#dc2626", shapeType: "rectangle", zIndex: 1 },
      { type: "shape", x: 376, y: 456, width: 8, height: 120, backgroundColor: "#dc2626", shapeType: "rectangle", zIndex: 1 },
      // Event info
      { type: "text", x: 20, y: 35, width: 344, height: 24, content: "{{event_name}}", fontSize: 14, fontWeight: "bold", color: "#dc2626", align: "center", zIndex: 1 },
      { type: "text", x: 20, y: 62, width: 344, height: 20, content: "{{event_date}}", fontSize: 11, color: "#6b7280", align: "center", zIndex: 1 },
      // Name
      { type: "text", x: 20, y: 110, width: 344, height: 65, content: "{{name}}", fontSize: 34, fontWeight: "bold", color: "#1f2937", align: "center", zIndex: 1 },
      // Credentials
      { type: "text", x: 20, y: 185, width: 344, height: 26, content: "{{designation}}", fontSize: 15, color: "#dc2626", align: "center", zIndex: 1 },
      { type: "text", x: 20, y: 215, width: 344, height: 24, content: "{{institution}}", fontSize: 13, color: "#6b7280", align: "center", zIndex: 1 },
      // Ticket badge
      { type: "shape", x: 112, y: 265, width: 160, height: 36, backgroundColor: "#dc2626", borderRadius: 4, shapeType: "rounded", zIndex: 1 },
      { type: "text", x: 112, y: 273, width: 160, height: 22, content: "{{ticket_type}}", fontSize: 13, fontWeight: "bold", color: "#ffffff", align: "center", textCase: "uppercase", zIndex: 2 },
      // QR
      { type: "qr_code", x: 117, y: 325, width: 150, height: 150, content: "{{registration_number}}", zIndex: 1 },
      // ID
      { type: "text", x: 20, y: 495, width: 344, height: 22, content: "{{registration_number}}", fontSize: 14, fontWeight: "bold", color: "#dc2626", align: "center", zIndex: 1 },
    ]
  },
  {
    name: "Gradient Wave",
    description: "Flowing wave design",
    size: "4x6",
    elements: [
      // White background
      { type: "shape", x: 0, y: 0, width: 384, height: 576, backgroundColor: "#ffffff", shapeType: "rectangle", zIndex: 0 },
      // Top wave section
      { type: "shape", x: 0, y: 0, width: 384, height: 100, backgroundColor: "#4f46e5", shapeType: "rectangle", zIndex: 1 },
      // Secondary wave
      { type: "shape", x: 0, y: 85, width: 384, height: 40, backgroundColor: "#6366f1", borderRadius: 0, shapeType: "rounded", zIndex: 0 },
      // Event info
      { type: "text", x: 20, y: 28, width: 344, height: 28, content: "{{event_name}}", fontSize: 16, fontWeight: "bold", color: "#ffffff", align: "center", zIndex: 2 },
      { type: "text", x: 20, y: 58, width: 344, height: 22, content: "{{event_date}}", fontSize: 12, color: "#c7d2fe", align: "center", zIndex: 2 },
      // Name
      { type: "text", x: 20, y: 145, width: 344, height: 65, content: "{{name}}", fontSize: 34, fontWeight: "bold", color: "#1f2937", align: "center", zIndex: 1 },
      // Credentials
      { type: "text", x: 20, y: 220, width: 344, height: 26, content: "{{designation}}", fontSize: 15, color: "#4f46e5", align: "center", zIndex: 1 },
      { type: "text", x: 20, y: 250, width: 344, height: 24, content: "{{institution}}", fontSize: 13, color: "#6b7280", align: "center", zIndex: 1 },
      // Ticket type
      { type: "shape", x: 112, y: 295, width: 160, height: 38, backgroundColor: "#4f46e5", borderRadius: 19, shapeType: "rounded", zIndex: 1 },
      { type: "text", x: 112, y: 303, width: 160, height: 24, content: "{{ticket_type}}", fontSize: 13, fontWeight: "bold", color: "#ffffff", align: "center", textCase: "uppercase", zIndex: 2 },
      // QR
      { type: "qr_code", x: 117, y: 355, width: 150, height: 150, content: "{{registration_number}}", zIndex: 1 },
      // ID
      { type: "text", x: 20, y: 520, width: 344, height: 22, content: "{{registration_number}}", fontSize: 14, fontWeight: "bold", color: "#4f46e5", align: "center", zIndex: 1 },
      // Bottom accent
      { type: "shape", x: 0, y: 555, width: 384, height: 21, backgroundColor: "#4f46e5", shapeType: "rectangle", zIndex: 1 },
    ]
  },
  {
    name: "Nameplate",
    description: "Large name focus",
    size: "4x6",
    elements: [
      // Background
      { type: "shape", x: 0, y: 0, width: 384, height: 576, backgroundColor: "#f1f5f9", shapeType: "rectangle", zIndex: 0 },
      // Dark header
      { type: "shape", x: 0, y: 0, width: 384, height: 70, backgroundColor: "#0f172a", shapeType: "rectangle", zIndex: 1 },
      // Event info
      { type: "text", x: 20, y: 22, width: 344, height: 24, content: "{{event_name}}", fontSize: 14, fontWeight: "bold", color: "#ffffff", align: "center", zIndex: 2 },
      { type: "text", x: 20, y: 46, width: 344, height: 18, content: "{{event_date}}", fontSize: 10, color: "#94a3b8", align: "center", zIndex: 2 },
      // Large name plate
      { type: "shape", x: 20, y: 90, width: 344, height: 100, backgroundColor: "#ffffff", borderRadius: 8, shapeType: "rounded", zIndex: 1 },
      { type: "text", x: 30, y: 115, width: 324, height: 60, content: "{{name}}", fontSize: 36, fontWeight: "bold", color: "#0f172a", align: "center", zIndex: 2 },
      // Credentials
      { type: "text", x: 20, y: 205, width: 344, height: 26, content: "{{designation}}", fontSize: 15, color: "#475569", align: "center", zIndex: 1 },
      { type: "text", x: 20, y: 235, width: 344, height: 24, content: "{{institution}}", fontSize: 13, color: "#64748b", align: "center", zIndex: 1 },
      // Ticket type
      { type: "shape", x: 132, y: 280, width: 120, height: 32, backgroundColor: "#0f172a", borderRadius: 16, shapeType: "rounded", zIndex: 1 },
      { type: "text", x: 132, y: 287, width: 120, height: 20, content: "{{ticket_type}}", fontSize: 12, fontWeight: "bold", color: "#ffffff", align: "center", textCase: "uppercase", zIndex: 2 },
      // QR
      { type: "qr_code", x: 117, y: 340, width: 150, height: 150, content: "{{registration_number}}", zIndex: 1 },
      // ID
      { type: "text", x: 20, y: 505, width: 344, height: 22, content: "{{registration_number}}", fontSize: 14, fontWeight: "bold", color: "#0f172a", align: "center", zIndex: 1 },
      // Footer
      { type: "shape", x: 0, y: 545, width: 384, height: 31, backgroundColor: "#0f172a", shapeType: "rectangle", zIndex: 1 },
    ]
  },
  {
    name: "Vibrant",
    description: "Bold and colorful",
    size: "4x6",
    elements: [
      // White background
      { type: "shape", x: 0, y: 0, width: 384, height: 576, backgroundColor: "#ffffff", shapeType: "rectangle", zIndex: 0 },
      // Orange header
      { type: "shape", x: 0, y: 0, width: 384, height: 105, backgroundColor: "#f97316", shapeType: "rectangle", zIndex: 1 },
      // Yellow accent strip
      { type: "shape", x: 0, y: 105, width: 384, height: 6, backgroundColor: "#fbbf24", shapeType: "rectangle", zIndex: 2 },
      // Event info
      { type: "text", x: 20, y: 30, width: 344, height: 28, content: "{{event_name}}", fontSize: 17, fontWeight: "bold", color: "#ffffff", align: "center", zIndex: 2 },
      { type: "text", x: 20, y: 62, width: 344, height: 22, content: "{{event_date}}", fontSize: 12, color: "#fed7aa", align: "center", zIndex: 2 },
      // Ticket badge
      { type: "shape", x: 137, y: 82, width: 110, height: 24, backgroundColor: "#ea580c", borderRadius: 12, shapeType: "rounded", zIndex: 2 },
      { type: "text", x: 137, y: 86, width: 110, height: 18, content: "{{ticket_type}}", fontSize: 11, fontWeight: "bold", color: "#ffffff", align: "center", textCase: "uppercase", zIndex: 3 },
      // Name
      { type: "text", x: 20, y: 140, width: 344, height: 65, content: "{{name}}", fontSize: 34, fontWeight: "bold", color: "#1f2937", align: "center", zIndex: 1 },
      // Credentials
      { type: "text", x: 20, y: 215, width: 344, height: 26, content: "{{designation}}", fontSize: 15, color: "#f97316", align: "center", zIndex: 1 },
      { type: "text", x: 20, y: 245, width: 344, height: 24, content: "{{institution}}", fontSize: 13, color: "#6b7280", align: "center", zIndex: 1 },
      // Decorative line
      { type: "line", x: 60, y: 290, width: 264, height: 2, color: "#fbbf24", zIndex: 1 },
      // QR with warm background
      { type: "shape", x: 102, y: 315, width: 180, height: 180, backgroundColor: "#fff7ed", borderRadius: 10, shapeType: "rounded", zIndex: 1 },
      { type: "qr_code", x: 117, y: 330, width: 150, height: 150, content: "{{registration_number}}", zIndex: 2 },
      // ID
      { type: "text", x: 20, y: 510, width: 344, height: 22, content: "{{registration_number}}", fontSize: 14, fontWeight: "bold", color: "#f97316", align: "center", zIndex: 1 },
      // Footer
      { type: "shape", x: 0, y: 550, width: 384, height: 26, backgroundColor: "#f97316", shapeType: "rectangle", zIndex: 1 },
    ]
  },
  // =====================================================
  // 4x3 TEMPLATES (384 × 288 pixels) - Compact versions
  // =====================================================
  {
    name: "Professional (4×3)",
    description: "Clean corporate design",
    size: "4x3",
    elements: [
      { type: "shape", x: 0, y: 0, width: 384, height: 288, backgroundColor: "#ffffff", shapeType: "rectangle", zIndex: 0 },
      { type: "shape", x: 0, y: 0, width: 384, height: 50, backgroundColor: "#1e40af", shapeType: "rectangle", zIndex: 1 },
      { type: "text", x: 10, y: 15, width: 364, height: 22, content: "{{event_name}}", fontSize: 13, fontWeight: "bold", color: "#ffffff", align: "center", zIndex: 2 },
      { type: "text", x: 10, y: 60, width: 260, height: 45, content: "{{name}}", fontSize: 26, fontWeight: "bold", color: "#1e293b", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 108, width: 260, height: 20, content: "{{designation}}", fontSize: 12, color: "#1e40af", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 128, width: 260, height: 18, content: "{{institution}}", fontSize: 11, color: "#64748b", align: "left", zIndex: 1 },
      { type: "shape", x: 10, y: 155, width: 90, height: 24, backgroundColor: "#1e40af", borderRadius: 12, shapeType: "rounded", zIndex: 1 },
      { type: "text", x: 10, y: 159, width: 90, height: 18, content: "{{ticket_type}}", fontSize: 10, fontWeight: "bold", color: "#ffffff", align: "center", textCase: "uppercase", zIndex: 2 },
      { type: "qr_code", x: 284, y: 58, width: 90, height: 90, content: "{{registration_number}}", zIndex: 1 },
      { type: "text", x: 284, y: 152, width: 90, height: 16, content: "{{registration_number}}", fontSize: 9, color: "#1e40af", align: "center", zIndex: 1 },
      { type: "shape", x: 0, y: 280, width: 384, height: 8, backgroundColor: "#1e40af", shapeType: "rectangle", zIndex: 1 },
    ]
  },
  {
    name: "Modern (4×3)",
    description: "Bold gradient header",
    size: "4x3",
    elements: [
      { type: "shape", x: 0, y: 0, width: 384, height: 288, backgroundColor: "#fafafa", shapeType: "rectangle", zIndex: 0 },
      { type: "shape", x: 0, y: 0, width: 384, height: 55, backgroundColor: "#7c3aed", shapeType: "rectangle", zIndex: 1 },
      { type: "shape", x: 0, y: 55, width: 384, height: 3, backgroundColor: "#a78bfa", shapeType: "rectangle", zIndex: 2 },
      { type: "text", x: 10, y: 18, width: 364, height: 22, content: "{{event_name}}", fontSize: 13, fontWeight: "bold", color: "#ffffff", align: "center", zIndex: 2 },
      { type: "text", x: 10, y: 68, width: 270, height: 45, content: "{{name}}", fontSize: 26, fontWeight: "bold", color: "#1f2937", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 116, width: 270, height: 20, content: "{{designation}}", fontSize: 12, color: "#7c3aed", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 136, width: 270, height: 18, content: "{{institution}}", fontSize: 11, color: "#6b7280", align: "left", zIndex: 1 },
      { type: "shape", x: 10, y: 162, width: 90, height: 24, backgroundColor: "#7c3aed", borderRadius: 12, shapeType: "rounded", zIndex: 1 },
      { type: "text", x: 10, y: 166, width: 90, height: 18, content: "{{ticket_type}}", fontSize: 10, fontWeight: "bold", color: "#ffffff", align: "center", textCase: "uppercase", zIndex: 2 },
      { type: "qr_code", x: 284, y: 68, width: 90, height: 90, content: "{{registration_number}}", zIndex: 1 },
      { type: "text", x: 284, y: 162, width: 90, height: 16, content: "{{registration_number}}", fontSize: 9, color: "#7c3aed", align: "center", zIndex: 1 },
      { type: "shape", x: 0, y: 282, width: 384, height: 6, backgroundColor: "#7c3aed", shapeType: "rectangle", zIndex: 1 },
    ]
  },
  {
    name: "Minimal (4×3)",
    description: "Simple and elegant",
    size: "4x3",
    elements: [
      { type: "shape", x: 0, y: 0, width: 384, height: 288, backgroundColor: "#ffffff", shapeType: "rectangle", zIndex: 0 },
      { type: "shape", x: 0, y: 0, width: 384, height: 4, backgroundColor: "#111827", shapeType: "rectangle", zIndex: 1 },
      { type: "text", x: 10, y: 15, width: 364, height: 18, content: "{{event_name}}", fontSize: 10, fontWeight: "bold", color: "#6b7280", align: "center", textCase: "uppercase", zIndex: 1 },
      { type: "text", x: 10, y: 45, width: 270, height: 50, content: "{{name}}", fontSize: 28, fontWeight: "bold", color: "#111827", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 100, width: 270, height: 20, content: "{{designation}}", fontSize: 12, color: "#374151", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 120, width: 270, height: 18, content: "{{institution}}", fontSize: 11, color: "#6b7280", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 150, width: 270, height: 18, content: "{{ticket_type}}", fontSize: 11, fontWeight: "bold", color: "#111827", align: "left", textCase: "uppercase", zIndex: 1 },
      { type: "qr_code", x: 284, y: 45, width: 90, height: 90, content: "{{registration_number}}", zIndex: 1 },
      { type: "text", x: 284, y: 140, width: 90, height: 16, content: "{{registration_number}}", fontSize: 9, color: "#6b7280", align: "center", zIndex: 1 },
      { type: "shape", x: 0, y: 284, width: 384, height: 4, backgroundColor: "#111827", shapeType: "rectangle", zIndex: 1 },
    ]
  },
  {
    name: "Event Badge (4×3)",
    description: "With event details",
    size: "4x3",
    elements: [
      { type: "shape", x: 0, y: 0, width: 384, height: 288, backgroundColor: "#ffffff", shapeType: "rectangle", zIndex: 0 },
      { type: "shape", x: 0, y: 0, width: 384, height: 45, backgroundColor: "#059669", shapeType: "rectangle", zIndex: 1 },
      { type: "shape", x: 0, y: 45, width: 384, height: 20, backgroundColor: "#047857", shapeType: "rectangle", zIndex: 1 },
      { type: "text", x: 10, y: 12, width: 364, height: 22, content: "{{event_name}}", fontSize: 13, fontWeight: "bold", color: "#ffffff", align: "center", zIndex: 2 },
      { type: "text", x: 10, y: 48, width: 364, height: 16, content: "{{ticket_type}}", fontSize: 10, fontWeight: "bold", color: "#ffffff", align: "center", textCase: "uppercase", zIndex: 2 },
      { type: "text", x: 10, y: 78, width: 270, height: 45, content: "{{name}}", fontSize: 26, fontWeight: "bold", color: "#1f2937", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 126, width: 270, height: 20, content: "{{designation}}", fontSize: 12, color: "#059669", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 146, width: 270, height: 18, content: "{{institution}}", fontSize: 11, color: "#6b7280", align: "left", zIndex: 1 },
      { type: "qr_code", x: 284, y: 78, width: 90, height: 90, content: "{{registration_number}}", zIndex: 1 },
      { type: "text", x: 284, y: 172, width: 90, height: 16, content: "{{registration_number}}", fontSize: 9, color: "#059669", align: "center", zIndex: 1 },
      { type: "shape", x: 0, y: 280, width: 384, height: 8, backgroundColor: "#059669", shapeType: "rectangle", zIndex: 1 },
    ]
  },
  {
    name: "Medical Conference (4×3)",
    description: "Healthcare & medical events",
    size: "4x3",
    elements: [
      { type: "shape", x: 0, y: 0, width: 384, height: 288, backgroundColor: "#ffffff", shapeType: "rectangle", zIndex: 0 },
      { type: "shape", x: 0, y: 0, width: 384, height: 5, backgroundColor: "#0d9488", shapeType: "rectangle", zIndex: 1 },
      { type: "shape", x: 0, y: 5, width: 384, height: 40, backgroundColor: "#f0fdfa", shapeType: "rectangle", zIndex: 1 },
      { type: "text", x: 10, y: 15, width: 364, height: 22, content: "{{event_name}}", fontSize: 12, fontWeight: "bold", color: "#0d9488", align: "center", zIndex: 2 },
      { type: "text", x: 10, y: 55, width: 270, height: 45, content: "{{name}}", fontSize: 26, fontWeight: "bold", color: "#0f172a", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 103, width: 270, height: 20, content: "{{designation}}", fontSize: 12, color: "#0d9488", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 123, width: 270, height: 18, content: "{{institution}}", fontSize: 11, color: "#64748b", align: "left", zIndex: 1 },
      { type: "shape", x: 10, y: 150, width: 90, height: 24, backgroundColor: "#0d9488", borderRadius: 12, shapeType: "rounded", zIndex: 1 },
      { type: "text", x: 10, y: 154, width: 90, height: 18, content: "{{ticket_type}}", fontSize: 10, fontWeight: "bold", color: "#ffffff", align: "center", textCase: "uppercase", zIndex: 2 },
      { type: "qr_code", x: 284, y: 55, width: 90, height: 90, content: "{{registration_number}}", zIndex: 1 },
      { type: "text", x: 284, y: 150, width: 90, height: 16, content: "{{registration_number}}", fontSize: 9, color: "#0d9488", align: "center", zIndex: 1 },
      { type: "shape", x: 0, y: 280, width: 384, height: 8, backgroundColor: "#0d9488", shapeType: "rectangle", zIndex: 1 },
    ]
  },
  {
    name: "Tech Summit (4×3)",
    description: "Dark theme for tech events",
    size: "4x3",
    elements: [
      { type: "shape", x: 0, y: 0, width: 384, height: 288, backgroundColor: "#18181b", shapeType: "rectangle", zIndex: 0 },
      { type: "shape", x: 0, y: 0, width: 384, height: 3, backgroundColor: "#8b5cf6", shapeType: "rectangle", zIndex: 1 },
      { type: "shape", x: 0, y: 285, width: 384, height: 3, backgroundColor: "#06b6d4", shapeType: "rectangle", zIndex: 1 },
      { type: "text", x: 10, y: 15, width: 364, height: 18, content: "{{event_name}}", fontSize: 10, fontWeight: "bold", color: "#8b5cf6", align: "center", textCase: "uppercase", zIndex: 1 },
      { type: "text", x: 10, y: 45, width: 270, height: 50, content: "{{name}}", fontSize: 26, fontWeight: "bold", color: "#fafafa", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 100, width: 270, height: 20, content: "{{designation}}", fontSize: 12, color: "#06b6d4", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 120, width: 270, height: 18, content: "{{institution}}", fontSize: 11, color: "#71717a", align: "left", zIndex: 1 },
      { type: "shape", x: 10, y: 148, width: 100, height: 26, backgroundColor: "#27272a", borderRadius: 6, borderWidth: 1, borderColor: "#8b5cf6", shapeType: "rounded", zIndex: 1 },
      { type: "text", x: 10, y: 154, width: 100, height: 18, content: "{{ticket_type}}", fontSize: 10, fontWeight: "bold", color: "#8b5cf6", align: "center", textCase: "uppercase", zIndex: 2 },
      { type: "shape", x: 279, y: 40, width: 100, height: 100, backgroundColor: "#ffffff", borderRadius: 8, shapeType: "rounded", zIndex: 1 },
      { type: "qr_code", x: 284, y: 45, width: 90, height: 90, content: "{{registration_number}}", zIndex: 2 },
      { type: "text", x: 279, y: 145, width: 100, height: 16, content: "{{registration_number}}", fontSize: 9, color: "#06b6d4", align: "center", zIndex: 1 },
    ]
  },
  {
    name: "Academic (4×3)",
    description: "Classic scholarly design",
    size: "4x3",
    elements: [
      { type: "shape", x: 0, y: 0, width: 384, height: 288, backgroundColor: "#fefce8", shapeType: "rectangle", zIndex: 0 },
      { type: "shape", x: 8, y: 8, width: 368, height: 272, backgroundColor: "transparent", borderWidth: 2, borderColor: "#92400e", shapeType: "rectangle", zIndex: 1 },
      { type: "text", x: 15, y: 20, width: 354, height: 20, content: "{{event_name}}", fontSize: 12, fontWeight: "bold", color: "#92400e", align: "center", zIndex: 2 },
      { type: "line", x: 117, y: 45, width: 150, height: 1, color: "#d97706", zIndex: 2 },
      { type: "text", x: 15, y: 55, width: 260, height: 45, content: "{{name}}", fontSize: 24, fontWeight: "bold", color: "#451a03", align: "left", zIndex: 2 },
      { type: "text", x: 15, y: 105, width: 260, height: 20, content: "{{designation}}", fontSize: 12, fontStyle: "italic", color: "#92400e", align: "left", zIndex: 2 },
      { type: "text", x: 15, y: 125, width: 260, height: 18, content: "{{institution}}", fontSize: 11, color: "#a16207", align: "left", zIndex: 2 },
      { type: "shape", x: 15, y: 152, width: 90, height: 24, backgroundColor: "#92400e", borderRadius: 4, shapeType: "rounded", zIndex: 2 },
      { type: "text", x: 15, y: 156, width: 90, height: 18, content: "{{ticket_type}}", fontSize: 10, fontWeight: "bold", color: "#fef3c7", align: "center", textCase: "uppercase", zIndex: 3 },
      { type: "qr_code", x: 279, y: 55, width: 90, height: 90, content: "{{registration_number}}", zIndex: 2 },
      { type: "text", x: 279, y: 150, width: 90, height: 16, content: "{{registration_number}}", fontSize: 9, color: "#92400e", align: "center", zIndex: 2 },
    ]
  },
  {
    name: "Creative (4×3)",
    description: "Colorful artistic design",
    size: "4x3",
    elements: [
      { type: "shape", x: 0, y: 0, width: 384, height: 288, backgroundColor: "#ffffff", shapeType: "rectangle", zIndex: 0 },
      { type: "shape", x: 0, y: 0, width: 384, height: 50, backgroundColor: "#d946ef", shapeType: "rectangle", zIndex: 1 },
      { type: "shape", x: 0, y: 50, width: 384, height: 4, backgroundColor: "#f0abfc", shapeType: "rectangle", zIndex: 2 },
      { type: "text", x: 10, y: 15, width: 364, height: 22, content: "{{event_name}}", fontSize: 13, fontWeight: "bold", color: "#ffffff", align: "center", zIndex: 2 },
      { type: "text", x: 10, y: 65, width: 270, height: 45, content: "{{name}}", fontSize: 26, fontWeight: "bold", color: "#1f2937", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 113, width: 270, height: 20, content: "{{designation}}", fontSize: 12, color: "#d946ef", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 133, width: 270, height: 18, content: "{{institution}}", fontSize: 11, color: "#6b7280", align: "left", zIndex: 1 },
      { type: "shape", x: 10, y: 160, width: 100, height: 26, backgroundColor: "#d946ef", borderRadius: 13, shapeType: "rounded", zIndex: 1 },
      { type: "text", x: 10, y: 166, width: 100, height: 18, content: "{{ticket_type}}", fontSize: 10, fontWeight: "bold", color: "#ffffff", align: "center", textCase: "uppercase", zIndex: 2 },
      { type: "qr_code", x: 284, y: 65, width: 90, height: 90, content: "{{registration_number}}", zIndex: 1 },
      { type: "text", x: 284, y: 160, width: 90, height: 16, content: "{{registration_number}}", fontSize: 9, color: "#d946ef", align: "center", zIndex: 1 },
    ]
  },
  {
    name: "Executive (4×3)",
    description: "Premium luxury feel",
    size: "4x3",
    elements: [
      { type: "shape", x: 0, y: 0, width: 384, height: 288, backgroundColor: "#1c1917", shapeType: "rectangle", zIndex: 0 },
      { type: "shape", x: 0, y: 0, width: 384, height: 4, backgroundColor: "#ca8a04", shapeType: "rectangle", zIndex: 1 },
      { type: "shape", x: 0, y: 284, width: 384, height: 4, backgroundColor: "#ca8a04", shapeType: "rectangle", zIndex: 1 },
      { type: "text", x: 10, y: 15, width: 364, height: 18, content: "{{event_name}}", fontSize: 10, fontWeight: "bold", color: "#ca8a04", align: "center", textCase: "uppercase", zIndex: 1 },
      { type: "text", x: 10, y: 45, width: 270, height: 50, content: "{{name}}", fontSize: 26, fontWeight: "bold", color: "#fef3c7", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 100, width: 270, height: 20, content: "{{designation}}", fontSize: 12, color: "#ca8a04", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 120, width: 270, height: 18, content: "{{institution}}", fontSize: 11, color: "#78716c", align: "left", zIndex: 1 },
      { type: "shape", x: 10, y: 148, width: 80, height: 26, backgroundColor: "transparent", borderWidth: 1, borderColor: "#ca8a04", borderRadius: 4, shapeType: "rounded", zIndex: 1 },
      { type: "text", x: 10, y: 154, width: 80, height: 18, content: "{{ticket_type}}", fontSize: 10, fontWeight: "bold", color: "#ca8a04", align: "center", textCase: "uppercase", zIndex: 2 },
      { type: "shape", x: 279, y: 40, width: 100, height: 100, backgroundColor: "#fef3c7", borderRadius: 6, shapeType: "rounded", zIndex: 1 },
      { type: "qr_code", x: 284, y: 45, width: 90, height: 90, content: "{{registration_number}}", zIndex: 2 },
      { type: "text", x: 279, y: 145, width: 100, height: 16, content: "{{registration_number}}", fontSize: 9, color: "#ca8a04", align: "center", zIndex: 1 },
    ]
  },
  {
    name: "Side Banner (4×3)",
    description: "Vertical accent strip",
    size: "4x3",
    elements: [
      { type: "shape", x: 0, y: 0, width: 384, height: 288, backgroundColor: "#f8fafc", shapeType: "rectangle", zIndex: 0 },
      { type: "shape", x: 0, y: 0, width: 12, height: 288, backgroundColor: "#2563eb", shapeType: "rectangle", zIndex: 1 },
      { type: "text", x: 22, y: 15, width: 352, height: 18, content: "{{event_name}}", fontSize: 11, fontWeight: "bold", color: "#2563eb", align: "left", zIndex: 1 },
      { type: "text", x: 22, y: 45, width: 260, height: 50, content: "{{name}}", fontSize: 26, fontWeight: "bold", color: "#0f172a", align: "left", zIndex: 1 },
      { type: "text", x: 22, y: 100, width: 260, height: 20, content: "{{designation}}", fontSize: 12, color: "#2563eb", align: "left", zIndex: 1 },
      { type: "text", x: 22, y: 120, width: 260, height: 18, content: "{{institution}}", fontSize: 11, color: "#64748b", align: "left", zIndex: 1 },
      { type: "shape", x: 22, y: 148, width: 90, height: 24, backgroundColor: "#2563eb", borderRadius: 6, shapeType: "rounded", zIndex: 1 },
      { type: "text", x: 22, y: 152, width: 90, height: 18, content: "{{ticket_type}}", fontSize: 10, fontWeight: "bold", color: "#ffffff", align: "center", textCase: "uppercase", zIndex: 2 },
      { type: "qr_code", x: 284, y: 45, width: 90, height: 90, content: "{{registration_number}}", zIndex: 1 },
      { type: "text", x: 284, y: 140, width: 90, height: 16, content: "{{registration_number}}", fontSize: 9, color: "#2563eb", align: "center", zIndex: 1 },
      { type: "shape", x: 0, y: 270, width: 384, height: 18, backgroundColor: "#2563eb", shapeType: "rectangle", zIndex: 1 },
    ]
  },
  {
    name: "Dual Tone (4×3)",
    description: "Two-color split design",
    size: "4x3",
    elements: [
      { type: "shape", x: 0, y: 0, width: 384, height: 288, backgroundColor: "#ffffff", shapeType: "rectangle", zIndex: 0 },
      { type: "shape", x: 0, y: 0, width: 384, height: 55, backgroundColor: "#0ea5e9", shapeType: "rectangle", zIndex: 1 },
      { type: "shape", x: 0, y: 240, width: 384, height: 48, backgroundColor: "#0c4a6e", shapeType: "rectangle", zIndex: 1 },
      { type: "text", x: 10, y: 10, width: 364, height: 20, content: "{{event_name}}", fontSize: 12, fontWeight: "bold", color: "#ffffff", align: "center", zIndex: 2 },
      { type: "shape", x: 147, y: 33, width: 90, height: 20, backgroundColor: "#0369a1", borderRadius: 10, shapeType: "rounded", zIndex: 2 },
      { type: "text", x: 147, y: 36, width: 90, height: 16, content: "{{ticket_type}}", fontSize: 9, fontWeight: "bold", color: "#ffffff", align: "center", textCase: "uppercase", zIndex: 3 },
      { type: "text", x: 10, y: 65, width: 270, height: 45, content: "{{name}}", fontSize: 26, fontWeight: "bold", color: "#0f172a", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 115, width: 270, height: 20, content: "{{designation}}", fontSize: 12, color: "#0ea5e9", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 135, width: 270, height: 18, content: "{{institution}}", fontSize: 11, color: "#64748b", align: "left", zIndex: 1 },
      { type: "qr_code", x: 284, y: 65, width: 90, height: 90, content: "{{registration_number}}", zIndex: 1 },
      { type: "text", x: 10, y: 255, width: 364, height: 16, content: "{{registration_number}}", fontSize: 10, fontWeight: "bold", color: "#ffffff", align: "center", zIndex: 2 },
    ]
  },
  {
    name: "Corner Accent (4×3)",
    description: "Elegant corner design",
    size: "4x3",
    elements: [
      { type: "shape", x: 0, y: 0, width: 384, height: 288, backgroundColor: "#ffffff", shapeType: "rectangle", zIndex: 0 },
      { type: "shape", x: 0, y: 0, width: 80, height: 5, backgroundColor: "#dc2626", shapeType: "rectangle", zIndex: 1 },
      { type: "shape", x: 0, y: 0, width: 5, height: 80, backgroundColor: "#dc2626", shapeType: "rectangle", zIndex: 1 },
      { type: "shape", x: 304, y: 283, width: 80, height: 5, backgroundColor: "#dc2626", shapeType: "rectangle", zIndex: 1 },
      { type: "shape", x: 379, y: 208, width: 5, height: 80, backgroundColor: "#dc2626", shapeType: "rectangle", zIndex: 1 },
      { type: "text", x: 10, y: 15, width: 364, height: 18, content: "{{event_name}}", fontSize: 11, fontWeight: "bold", color: "#dc2626", align: "center", zIndex: 1 },
      { type: "text", x: 10, y: 45, width: 270, height: 50, content: "{{name}}", fontSize: 26, fontWeight: "bold", color: "#1f2937", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 100, width: 270, height: 20, content: "{{designation}}", fontSize: 12, color: "#dc2626", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 120, width: 270, height: 18, content: "{{institution}}", fontSize: 11, color: "#6b7280", align: "left", zIndex: 1 },
      { type: "shape", x: 10, y: 148, width: 90, height: 24, backgroundColor: "#dc2626", borderRadius: 4, shapeType: "rounded", zIndex: 1 },
      { type: "text", x: 10, y: 152, width: 90, height: 18, content: "{{ticket_type}}", fontSize: 10, fontWeight: "bold", color: "#ffffff", align: "center", textCase: "uppercase", zIndex: 2 },
      { type: "qr_code", x: 284, y: 45, width: 90, height: 90, content: "{{registration_number}}", zIndex: 1 },
      { type: "text", x: 284, y: 140, width: 90, height: 16, content: "{{registration_number}}", fontSize: 9, color: "#dc2626", align: "center", zIndex: 1 },
    ]
  },
  {
    name: "Gradient Wave (4×3)",
    description: "Flowing wave design",
    size: "4x3",
    elements: [
      { type: "shape", x: 0, y: 0, width: 384, height: 288, backgroundColor: "#ffffff", shapeType: "rectangle", zIndex: 0 },
      { type: "shape", x: 0, y: 0, width: 384, height: 50, backgroundColor: "#4f46e5", shapeType: "rectangle", zIndex: 1 },
      { type: "shape", x: 0, y: 45, width: 384, height: 15, backgroundColor: "#6366f1", shapeType: "rectangle", zIndex: 0 },
      { type: "text", x: 10, y: 15, width: 364, height: 22, content: "{{event_name}}", fontSize: 13, fontWeight: "bold", color: "#ffffff", align: "center", zIndex: 2 },
      { type: "text", x: 10, y: 70, width: 270, height: 45, content: "{{name}}", fontSize: 26, fontWeight: "bold", color: "#1f2937", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 120, width: 270, height: 20, content: "{{designation}}", fontSize: 12, color: "#4f46e5", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 140, width: 270, height: 18, content: "{{institution}}", fontSize: 11, color: "#6b7280", align: "left", zIndex: 1 },
      { type: "shape", x: 10, y: 168, width: 100, height: 26, backgroundColor: "#4f46e5", borderRadius: 13, shapeType: "rounded", zIndex: 1 },
      { type: "text", x: 10, y: 174, width: 100, height: 18, content: "{{ticket_type}}", fontSize: 10, fontWeight: "bold", color: "#ffffff", align: "center", textCase: "uppercase", zIndex: 2 },
      { type: "qr_code", x: 284, y: 70, width: 90, height: 90, content: "{{registration_number}}", zIndex: 1 },
      { type: "text", x: 284, y: 165, width: 90, height: 16, content: "{{registration_number}}", fontSize: 9, color: "#4f46e5", align: "center", zIndex: 1 },
      { type: "shape", x: 0, y: 280, width: 384, height: 8, backgroundColor: "#4f46e5", shapeType: "rectangle", zIndex: 1 },
    ]
  },
  {
    name: "Nameplate (4×3)",
    description: "Large name focus",
    size: "4x3",
    elements: [
      { type: "shape", x: 0, y: 0, width: 384, height: 288, backgroundColor: "#f1f5f9", shapeType: "rectangle", zIndex: 0 },
      { type: "shape", x: 0, y: 0, width: 384, height: 40, backgroundColor: "#0f172a", shapeType: "rectangle", zIndex: 1 },
      { type: "text", x: 10, y: 12, width: 364, height: 18, content: "{{event_name}}", fontSize: 11, fontWeight: "bold", color: "#ffffff", align: "center", zIndex: 2 },
      { type: "shape", x: 10, y: 50, width: 270, height: 60, backgroundColor: "#ffffff", borderRadius: 6, shapeType: "rounded", zIndex: 1 },
      { type: "text", x: 15, y: 60, width: 260, height: 45, content: "{{name}}", fontSize: 28, fontWeight: "bold", color: "#0f172a", align: "left", zIndex: 2 },
      { type: "text", x: 10, y: 120, width: 270, height: 20, content: "{{designation}}", fontSize: 12, color: "#475569", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 140, width: 270, height: 18, content: "{{institution}}", fontSize: 11, color: "#64748b", align: "left", zIndex: 1 },
      { type: "shape", x: 10, y: 168, width: 80, height: 22, backgroundColor: "#0f172a", borderRadius: 11, shapeType: "rounded", zIndex: 1 },
      { type: "text", x: 10, y: 172, width: 80, height: 16, content: "{{ticket_type}}", fontSize: 9, fontWeight: "bold", color: "#ffffff", align: "center", textCase: "uppercase", zIndex: 2 },
      { type: "qr_code", x: 284, y: 50, width: 90, height: 90, content: "{{registration_number}}", zIndex: 1 },
      { type: "text", x: 284, y: 145, width: 90, height: 16, content: "{{registration_number}}", fontSize: 9, color: "#0f172a", align: "center", zIndex: 1 },
      { type: "shape", x: 0, y: 270, width: 384, height: 18, backgroundColor: "#0f172a", shapeType: "rectangle", zIndex: 1 },
    ]
  },
  {
    name: "Vibrant (4×3)",
    description: "Bold and colorful",
    size: "4x3",
    elements: [
      { type: "shape", x: 0, y: 0, width: 384, height: 288, backgroundColor: "#ffffff", shapeType: "rectangle", zIndex: 0 },
      { type: "shape", x: 0, y: 0, width: 384, height: 50, backgroundColor: "#f97316", shapeType: "rectangle", zIndex: 1 },
      { type: "shape", x: 0, y: 50, width: 384, height: 4, backgroundColor: "#fbbf24", shapeType: "rectangle", zIndex: 2 },
      { type: "text", x: 10, y: 15, width: 364, height: 22, content: "{{event_name}}", fontSize: 13, fontWeight: "bold", color: "#ffffff", align: "center", zIndex: 2 },
      { type: "text", x: 10, y: 65, width: 270, height: 45, content: "{{name}}", fontSize: 26, fontWeight: "bold", color: "#1f2937", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 115, width: 270, height: 20, content: "{{designation}}", fontSize: 12, color: "#f97316", align: "left", zIndex: 1 },
      { type: "text", x: 10, y: 135, width: 270, height: 18, content: "{{institution}}", fontSize: 11, color: "#6b7280", align: "left", zIndex: 1 },
      { type: "shape", x: 10, y: 163, width: 90, height: 24, backgroundColor: "#f97316", borderRadius: 12, shapeType: "rounded", zIndex: 1 },
      { type: "text", x: 10, y: 167, width: 90, height: 18, content: "{{ticket_type}}", fontSize: 10, fontWeight: "bold", color: "#ffffff", align: "center", textCase: "uppercase", zIndex: 2 },
      { type: "qr_code", x: 284, y: 65, width: 90, height: 90, content: "{{registration_number}}", zIndex: 1 },
      { type: "text", x: 284, y: 160, width: 90, height: 16, content: "{{registration_number}}", fontSize: 9, color: "#f97316", align: "center", zIndex: 1 },
      { type: "shape", x: 0, y: 278, width: 384, height: 10, backgroundColor: "#f97316", shapeType: "rectangle", zIndex: 1 },
    ]
  }
]

interface BadgeElement {
  id: string
  type: "text" | "qr_code" | "image" | "shape" | "line" | "barcode" | "photo"
  x: number
  y: number
  width: number
  height: number
  content?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: "normal" | "bold"
  fontStyle?: "normal" | "italic"
  textCase?: "none" | "uppercase" | "lowercase" | "capitalize"
  letterSpacing?: number
  lineHeight?: number
  color?: string
  backgroundColor?: string
  align?: "left" | "center" | "right"
  borderRadius?: number
  borderWidth?: number
  borderColor?: string
  opacity?: number
  locked?: boolean
  visible?: boolean
  imageUrl?: string
  zIndex: number
  lineStyle?: "solid" | "dashed" | "dotted"
  shadowEnabled?: boolean
  shadowColor?: string
  shadowBlur?: number
  shadowOffsetX?: number
  shadowOffsetY?: number
  // New properties
  rotation?: number
  shapeType?: "rectangle" | "circle" | "rounded" | "triangle"
  barcodeFormat?: "CODE128" | "CODE39" | "EAN13" | "UPC"
  gradient?: {
    enabled: boolean
    type: "linear" | "radial"
    colors: string[]
    angle?: number
  }
}

interface BadgeTemplate {
  id: string
  name: string
  size: keyof typeof BADGE_SIZES
  backgroundColor: string
  backgroundImageUrl: string | null
  elements: BadgeElement[]
}

export default function BadgeDesignerPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const templateIdFromUrl = searchParams.get("template")
  const prebuiltFromUrl = searchParams.get("prebuilt")
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const elementImageInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [templateLoaded, setTemplateLoaded] = useState(false)

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Load Google Fonts
  useEffect(() => {
    const googleFonts = FONT_OPTIONS.filter(f => f.isGoogle).map(f => f.label.replace(/ /g, '+'))
    if (googleFonts.length > 0) {
      const link = document.createElement('link')
      link.href = `https://fonts.googleapis.com/css2?family=${googleFonts.join('&family=')}&display=swap`
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
  }, [])

  // State
  const [template, setTemplate] = useState<BadgeTemplate>({
    id: "",
    name: "New Badge Template",
    size: "4x3",
    backgroundColor: "#ffffff",
    backgroundImageUrl: null,
    elements: [],
  })
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([])
  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(true)
  const [previewMode, setPreviewMode] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(true) // Start as true for new templates
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false)
  const [printFilter, setPrintFilter] = useState("all")
  const [selectedTicketTypes, setSelectedTicketTypes] = useState<string[]>([])
  const [leftTab, setLeftTab] = useState<"elements" | "design" | "layers">("elements")
  const [previewSearch, setPreviewSearch] = useState("")
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [snapGuides, setSnapGuides] = useState<{ horizontal: number[]; vertical: number[] }>({ horizontal: [], vertical: [] })
  const [showRulers, setShowRulers] = useState(true)
  const [isPreBuiltDialogOpen, setIsPreBuiltDialogOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<"pdf">("pdf")
  const [badgesPerPage, setBadgesPerPage] = useState(1)

  // History
  const [history, setHistory] = useState<BadgeTemplate[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [clipboard, setClipboard] = useState<BadgeElement[]>([])
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; elementId: string } | null>(null)

  // History functions
  const saveToHistory = useCallback((newTemplate: BadgeTemplate) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1)
      return [...newHistory, JSON.parse(JSON.stringify(newTemplate))].slice(-50)
    })
    setHistoryIndex((prev) => Math.min(prev + 1, 49))
    setHasUnsavedChanges(true) // Mark as having unsaved changes
  }, [historyIndex])

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1)
      setTemplate(JSON.parse(JSON.stringify(history[historyIndex - 1])))
      setHasUnsavedChanges(true)
    }
  }, [history, historyIndex])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((prev) => prev + 1)
      setTemplate(JSON.parse(JSON.stringify(history[historyIndex + 1])))
      setHasUnsavedChanges(true)
    }
  }, [history, historyIndex])

  const copyElements = useCallback(() => {
    const elementsToCopy = template.elements.filter((e) => selectedElementIds.includes(e.id))
    if (elementsToCopy.length > 0) {
      setClipboard(JSON.parse(JSON.stringify(elementsToCopy)))
      toast.success(`Copied ${elementsToCopy.length} element(s)`)
    }
  }, [template.elements, selectedElementIds])

  const pasteElements = useCallback(() => {
    if (clipboard.length === 0) return
    const newElements = clipboard.map((el) => ({
      ...el,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      x: el.x + 20,
      y: el.y + 20,
      zIndex: Math.max(...template.elements.map((e) => e.zIndex), 0) + 1,
    }))
    setTemplate((prev) => {
      const newTemplate = { ...prev, elements: [...prev.elements, ...newElements] }
      saveToHistory(newTemplate)
      return newTemplate
    })
    setSelectedElementIds(newElements.map((e) => e.id))
    toast.success(`Pasted ${newElements.length} element(s)`)
  }, [clipboard, template.elements, saveToHistory])

  const bringToFront = useCallback(() => {
    if (selectedElementIds.length === 0) return
    const maxZ = Math.max(...template.elements.map((e) => e.zIndex))
    setTemplate((prev) => {
      const newTemplate = {
        ...prev,
        elements: prev.elements.map((el) =>
          selectedElementIds.includes(el.id) ? { ...el, zIndex: maxZ + 1 } : el
        ),
      }
      saveToHistory(newTemplate)
      return newTemplate
    })
  }, [selectedElementIds, template.elements, saveToHistory])

  const sendToBack = useCallback(() => {
    if (selectedElementIds.length === 0) return
    const minZ = Math.min(...template.elements.map((e) => e.zIndex))
    setTemplate((prev) => {
      const newTemplate = {
        ...prev,
        elements: prev.elements.map((el) =>
          selectedElementIds.includes(el.id) ? { ...el, zIndex: minZ - 1 } : el
        ),
      }
      saveToHistory(newTemplate)
      return newTemplate
    })
  }, [selectedElementIds, template.elements, saveToHistory])

  const alignElements = useCallback((alignment: "left" | "center" | "right" | "top" | "middle" | "bottom") => {
    if (selectedElementIds.length < 2) return
    const selectedEls = template.elements.filter((e) => selectedElementIds.includes(e.id))
    let targetValue: number = 0

    switch (alignment) {
      case "left": targetValue = Math.min(...selectedEls.map((e) => e.x)); break
      case "right": targetValue = Math.max(...selectedEls.map((e) => e.x + e.width)); break
      case "top": targetValue = Math.min(...selectedEls.map((e) => e.y)); break
      case "bottom": targetValue = Math.max(...selectedEls.map((e) => e.y + e.height)); break
    }

    setTemplate((prev) => {
      const newTemplate = {
        ...prev,
        elements: prev.elements.map((el) => {
          if (!selectedElementIds.includes(el.id)) return el
          switch (alignment) {
            case "left": return { ...el, x: targetValue }
            case "center":
              const avgCenterX = selectedEls.reduce((sum, e) => sum + e.x + e.width / 2, 0) / selectedEls.length
              return { ...el, x: avgCenterX - el.width / 2 }
            case "right": return { ...el, x: targetValue - el.width }
            case "top": return { ...el, y: targetValue }
            case "middle":
              const avgCenterY = selectedEls.reduce((sum, e) => sum + e.y + e.height / 2, 0) / selectedEls.length
              return { ...el, y: avgCenterY - el.height / 2 }
            case "bottom": return { ...el, y: targetValue - el.height }
            default: return el
          }
        }),
      }
      saveToHistory(newTemplate)
      return newTemplate
    })
  }, [selectedElementIds, template.elements, saveToHistory])

  const distributeElements = useCallback((direction: "horizontal" | "vertical") => {
    if (selectedElementIds.length < 3) return
    const selectedEls = template.elements
      .filter((e) => selectedElementIds.includes(e.id))
      .sort((a, b) => direction === "horizontal" ? a.x - b.x : a.y - b.y)

    const first = selectedEls[0]
    const last = selectedEls[selectedEls.length - 1]
    const totalSpace = direction === "horizontal"
      ? (last.x + last.width) - first.x - selectedEls.reduce((sum, e) => sum + e.width, 0)
      : (last.y + last.height) - first.y - selectedEls.reduce((sum, e) => sum + e.height, 0)
    const gap = totalSpace / (selectedEls.length - 1)

    setTemplate((prev) => {
      let currentPos = direction === "horizontal" ? first.x + first.width + gap : first.y + first.height + gap
      const updates: Record<string, number> = {}
      selectedEls.slice(1, -1).forEach((el) => {
        updates[el.id] = currentPos
        currentPos += (direction === "horizontal" ? el.width : el.height) + gap
      })

      const newTemplate = {
        ...prev,
        elements: prev.elements.map((el) => {
          if (updates[el.id] !== undefined) {
            return direction === "horizontal" ? { ...el, x: updates[el.id] } : { ...el, y: updates[el.id] }
          }
          return el
        }),
      }
      saveToHistory(newTemplate)
      return newTemplate
    })
  }, [selectedElementIds, template.elements, saveToHistory])

  const toggleVisibility = useCallback((elementId: string) => {
    setTemplate((prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === elementId ? { ...el, visible: el.visible === false ? true : false } : el
      ),
    }))
  }, [])

  // Queries
  const { data: event } = useQuery({
    queryKey: ["event-badge", eventId],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id, name, short_name, logo_url, start_date, end_date").eq("id", eventId).single()
      return data as { id: string; name: string; short_name: string; logo_url: string | null; start_date: string | null; end_date: string | null } | null
    },
  })

  const { data: ticketTypes } = useQuery({
    queryKey: ["ticket-types-badge", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("ticket_types").select("id, name").eq("event_id", eventId)
      return data || []
    },
  })

  const { data: savedTemplates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["badge-templates", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/badge-templates?event_id=${eventId}`, { cache: "no-store" })
      if (!res.ok) return []
      return res.json()
    },
    staleTime: 0,
    refetchOnMount: "always",
  })

  // Auto-load template from URL parameter
  useEffect(() => {
    if (templateIdFromUrl && savedTemplates && !templateLoaded) {
      const templateToLoad = savedTemplates.find((t: any) => t.id === templateIdFromUrl)
      if (templateToLoad) {
        // Parse template_data if it's a string (can happen with JSONB columns)
        let data = templateToLoad.template_data || {}
        if (typeof data === "string") {
          try {
            data = JSON.parse(data)
          } catch (e) {
            console.error("Failed to parse template_data:", e)
            data = {}
          }
        }
        // Debug logging for auto-load
        console.log("Auto-loading template from URL:", {
          id: templateToLoad.id,
          name: templateToLoad.name,
          template_data: data,
          template_data_type: typeof templateToLoad.template_data,
          elements: data.elements,
          elements_count: data.elements?.length || 0,
        })
        setTemplate({
          id: templateToLoad.id,
          name: templateToLoad.name,
          size: templateToLoad.size || "4x3",
          backgroundColor: data.backgroundColor || "#ffffff",
          backgroundImageUrl: templateToLoad.template_image_url,
          elements: data.elements || [],
        })
        setSavedTemplateId(templateToLoad.id)
        setHasUnsavedChanges(false)
        setSelectedTicketTypes(templateToLoad.ticket_type_ids || [])
        setTemplateLoaded(true)

        // Show appropriate message based on elements
        if (!data.elements || data.elements.length === 0) {
          toast.warning(`Template "${templateToLoad.name}" has no design elements. The design was not saved properly. Please add elements and save.`, { duration: 6000 })
        } else {
          toast.success(`Loaded: ${templateToLoad.name} (${data.elements.length} elements)`)
        }
      }
    }
  }, [templateIdFromUrl, savedTemplates, templateLoaded])

  // Auto-load pre-built template from URL parameter
  useEffect(() => {
    if (prebuiltFromUrl && !templateLoaded) {
      const prebuiltTemplate = PRE_BUILT_TEMPLATES.find((t) => t.name === prebuiltFromUrl)
      if (prebuiltTemplate) {
        const elementsWithIds = prebuiltTemplate.elements.map((el, idx) => ({
          ...el,
          id: `prebuilt-${Date.now()}-${idx}`,
        }))
        setTemplate({
          id: "",
          name: prebuiltTemplate.name,
          size: prebuiltTemplate.size as keyof typeof BADGE_SIZES,
          backgroundColor: elementsWithIds.find(e => e.type === "shape" && e.zIndex === 0)?.backgroundColor || "#ffffff",
          backgroundImageUrl: null,
          elements: elementsWithIds,
        })
        setSavedTemplateId(null)
        setHasUnsavedChanges(true)
        setTemplateLoaded(true)
        toast.success(`Loaded "${prebuiltTemplate.name}" template (${BADGE_SIZES[prebuiltTemplate.size as keyof typeof BADGE_SIZES]?.label || prebuiltTemplate.size})`)
      }
    }
  }, [prebuiltFromUrl, templateLoaded])

  const { data: registrations } = useQuery({
    queryKey: ["registrations-badge", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select(`id, registration_number, attendee_name, attendee_email, attendee_phone, attendee_institution, attendee_designation, ticket_type_id, ticket_types (name), registration_addons (addon_id, addons (name))`)
        .eq("event_id", eventId)
        .eq("status", "confirmed")
        .order("created_at", { ascending: false })
      return data || []
    },
  })

  const selectedElement = selectedElementIds.length === 1 ? template.elements.find((e) => e.id === selectedElementIds[0]) : null

  // Filter registrations based on search
  const filteredRegistrations = registrations?.filter((r: any) => {
    if (!previewSearch.trim()) return true
    const search = previewSearch.toLowerCase()
    return (
      r.attendee_name?.toLowerCase().includes(search) ||
      r.registration_number?.toLowerCase().includes(search) ||
      r.attendee_email?.toLowerCase().includes(search) ||
      r.attendee_institution?.toLowerCase().includes(search)
    )
  }) || []

  const currentRegistration = filteredRegistrations?.[previewIndex]
  const badgeSize = BADGE_SIZES[template.size]

  // Handlers
  const handleElementSelect = useCallback((elementId: string, e?: React.MouseEvent) => {
    if (e?.shiftKey || e?.ctrlKey || e?.metaKey) {
      setSelectedElementIds((prev) => prev.includes(elementId) ? prev.filter((id) => id !== elementId) : [...prev, elementId])
    } else {
      setSelectedElementIds([elementId])
    }
  }, [])

  const replacePlaceholders = useCallback((text: string, registration?: any) => {
    if (!text) return ""
    let result = text
    result = result.replace(/\{\{name\}\}/g, registration?.attendee_name || "John Doe")
    result = result.replace(/\{\{registration_number\}\}/g, registration?.registration_number || "REG001")
    result = result.replace(/\{\{ticket_type\}\}/g, registration?.ticket_types?.name || "Delegate")
    result = result.replace(/\{\{email\}\}/g, registration?.attendee_email || "email@example.com")
    result = result.replace(/\{\{phone\}\}/g, registration?.attendee_phone || "+91 9876543210")
    result = result.replace(/\{\{institution\}\}/g, registration?.attendee_institution || "Institution")
    result = result.replace(/\{\{designation\}\}/g, registration?.attendee_designation || "Designation")
    result = result.replace(/\{\{event_name\}\}/g, event?.name || "Event Name")

    // Addons - comma-separated list of purchased addon names
    const addonNames = (registration?.registration_addons || [])
      .map((ra: any) => ra.addons?.name)
      .filter(Boolean)
      .join(", ")
    result = result.replace(/\{\{addons\}\}/g, addonNames || "")

    if (event?.start_date && event?.end_date) {
      const start = new Date(event.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
      const end = new Date(event.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      result = result.replace(/\{\{event_date\}\}/g, `${start} - ${end}`)
    } else {
      result = result.replace(/\{\{event_date\}\}/g, "Event Date")
    }
    return result
  }, [event])

  const updateElement = useCallback((elementId: string, updates: Partial<BadgeElement>) => {
    setTemplate((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => el.id === elementId ? { ...el, ...updates } : el),
    }))
    setHasUnsavedChanges(true) // Mark as having unsaved changes
  }, [])

  // Quick alignment functions
  const centerHorizontally = useCallback(() => {
    selectedElementIds.forEach((id) => {
      const element = template.elements.find((el) => el.id === id)
      if (element && !element.locked) {
        updateElement(id, { x: Math.round((badgeSize.width - element.width) / 2) })
      }
    })
  }, [selectedElementIds, template.elements, badgeSize.width, updateElement])

  const centerVertically = useCallback(() => {
    selectedElementIds.forEach((id) => {
      const element = template.elements.find((el) => el.id === id)
      if (element && !element.locked) {
        updateElement(id, { y: Math.round((badgeSize.height - element.height) / 2) })
      }
    })
  }, [selectedElementIds, template.elements, badgeSize.height, updateElement])

  // Smart snap calculation - finds alignment guides with other elements
  const calculateSnapGuides = useCallback((draggedId: string, newX: number, newY: number, width: number, height: number) => {
    if (!snapEnabled) return { guides: { horizontal: [], vertical: [] }, snapX: newX, snapY: newY }

    const threshold = 5
    const horizontal: number[] = []
    const vertical: number[] = []
    let snapX = newX
    let snapY = newY

    // Canvas center and edges
    const canvasCenterX = badgeSize.width / 2
    const canvasCenterY = badgeSize.height / 2
    const draggedCenterX = newX + width / 2
    const draggedCenterY = newY + height / 2
    const draggedRight = newX + width
    const draggedBottom = newY + height

    // Snap to canvas center
    if (Math.abs(draggedCenterX - canvasCenterX) < threshold) {
      vertical.push(canvasCenterX)
      snapX = canvasCenterX - width / 2
    }
    if (Math.abs(draggedCenterY - canvasCenterY) < threshold) {
      horizontal.push(canvasCenterY)
      snapY = canvasCenterY - height / 2
    }

    // Snap to canvas edges
    if (Math.abs(newX) < threshold) { vertical.push(0); snapX = 0 }
    if (Math.abs(newY) < threshold) { horizontal.push(0); snapY = 0 }
    if (Math.abs(draggedRight - badgeSize.width) < threshold) { vertical.push(badgeSize.width); snapX = badgeSize.width - width }
    if (Math.abs(draggedBottom - badgeSize.height) < threshold) { horizontal.push(badgeSize.height); snapY = badgeSize.height - height }

    // Snap to other elements
    template.elements.forEach((other) => {
      if (other.id === draggedId) return
      const otherCenterX = other.x + other.width / 2
      const otherCenterY = other.y + other.height / 2
      const otherRight = other.x + other.width
      const otherBottom = other.y + other.height

      // Left edge to left/right edge of other
      if (Math.abs(newX - other.x) < threshold) { vertical.push(other.x); snapX = other.x }
      if (Math.abs(newX - otherRight) < threshold) { vertical.push(otherRight); snapX = otherRight }
      // Right edge to left/right edge of other
      if (Math.abs(draggedRight - other.x) < threshold) { vertical.push(other.x); snapX = other.x - width }
      if (Math.abs(draggedRight - otherRight) < threshold) { vertical.push(otherRight); snapX = otherRight - width }
      // Center to center
      if (Math.abs(draggedCenterX - otherCenterX) < threshold) { vertical.push(otherCenterX); snapX = otherCenterX - width / 2 }

      // Top edge to top/bottom edge of other
      if (Math.abs(newY - other.y) < threshold) { horizontal.push(other.y); snapY = other.y }
      if (Math.abs(newY - otherBottom) < threshold) { horizontal.push(otherBottom); snapY = otherBottom }
      // Bottom edge to top/bottom edge of other
      if (Math.abs(draggedBottom - other.y) < threshold) { horizontal.push(other.y); snapY = other.y - height }
      if (Math.abs(draggedBottom - otherBottom) < threshold) { horizontal.push(otherBottom); snapY = otherBottom - height }
      // Center to center
      if (Math.abs(draggedCenterY - otherCenterY) < threshold) { horizontal.push(otherCenterY); snapY = otherCenterY - height / 2 }
    })

    return { guides: { horizontal: [...new Set(horizontal)], vertical: [...new Set(vertical)] }, snapX, snapY }
  }, [snapEnabled, badgeSize, template.elements])

  const addPredefinedField = (field: typeof PREDEFINED_FIELDS[0]) => {
    const newElement: BadgeElement = {
      id: Date.now().toString(),
      type: "text",
      x: (badgeSize.width - field.defaultSize.w) / 2,
      y: 50 + template.elements.length * 35,
      width: field.defaultSize.w,
      height: field.defaultSize.h,
      content: field.placeholder,
      fontSize: field.fontSize,
      fontFamily: "Arial, sans-serif",
      fontWeight: field.fontWeight,
      color: "#000000",
      align: "center",
      zIndex: template.elements.length + 1,
    }
    setTemplate((prev) => ({ ...prev, elements: [...prev.elements, newElement] }))
    setSelectedElementIds([newElement.id])
  }

  const addQRCode = () => {
    const size = 80
    const newElement: BadgeElement = {
      id: Date.now().toString(),
      type: "qr_code",
      x: (badgeSize.width - size) / 2,
      y: badgeSize.height - size - 20,
      width: size,
      height: size,
      content: "{{registration_number}}",
      zIndex: template.elements.length + 1,
    }
    setTemplate((prev) => ({ ...prev, elements: [...prev.elements, newElement] }))
    setSelectedElementIds([newElement.id])
  }

  const addShape = (shapeType: "rectangle" | "circle" | "rounded" | "triangle" = "rectangle") => {
    const size = shapeType === "circle" ? 80 : undefined
    const newElement: BadgeElement = {
      id: Date.now().toString(),
      type: "shape",
      x: shapeType === "circle" ? (badgeSize.width - 80) / 2 : 0,
      y: shapeType === "circle" ? 50 : 0,
      width: size || badgeSize.width,
      height: size || 50,
      backgroundColor: "#3b82f6",
      borderRadius: shapeType === "rounded" ? 12 : shapeType === "circle" ? 999 : 0,
      shapeType,
      zIndex: 0,
    }
    setTemplate((prev) => ({ ...prev, elements: [...prev.elements, newElement] }))
    setSelectedElementIds([newElement.id])
  }

  const addBarcode = () => {
    const newElement: BadgeElement = {
      id: Date.now().toString(),
      type: "barcode",
      x: (badgeSize.width - 180) / 2,
      y: badgeSize.height - 60,
      width: 180,
      height: 50,
      content: "{{registration_number}}",
      barcodeFormat: "CODE128",
      zIndex: template.elements.length + 1,
    }
    setTemplate((prev) => ({ ...prev, elements: [...prev.elements, newElement] }))
    setSelectedElementIds([newElement.id])
  }

  const addPhoto = () => {
    const size = 80
    const newElement: BadgeElement = {
      id: Date.now().toString(),
      type: "photo",
      x: (badgeSize.width - size) / 2,
      y: 30,
      width: size,
      height: size,
      borderRadius: 999,
      borderWidth: 2,
      borderColor: "#e5e7eb",
      zIndex: template.elements.length + 1,
    }
    setTemplate((prev) => ({ ...prev, elements: [...prev.elements, newElement] }))
    setSelectedElementIds([newElement.id])
  }

  const applyPreBuiltTemplate = (templateData: typeof PRE_BUILT_TEMPLATES[0]) => {
    const elements: BadgeElement[] = templateData.elements.map((el, idx) => ({
      ...el,
      id: Date.now().toString() + idx,
    }))
    setTemplate((prev) => ({
      ...prev,
      elements,
      backgroundColor: "#ffffff",
    }))
    setIsPreBuiltDialogOpen(false)
    toast.success(`Applied "${templateData.name}" template`)
  }

  const addImage = () => {
    const newElement: BadgeElement = {
      id: Date.now().toString(),
      type: "image",
      x: 20,
      y: 20,
      width: 60,
      height: 60,
      imageUrl: event?.logo_url || "",
      zIndex: template.elements.length + 1,
    }
    setTemplate((prev) => ({ ...prev, elements: [...prev.elements, newElement] }))
    setSelectedElementIds([newElement.id])
  }

  const addLine = () => {
    const newElement: BadgeElement = {
      id: Date.now().toString(),
      type: "line",
      x: 20,
      y: badgeSize.height / 2,
      width: badgeSize.width - 40,
      height: 2,
      color: "#000000",
      lineStyle: "solid",
      opacity: 100,
      zIndex: template.elements.length + 1,
    }
    setTemplate((prev) => ({ ...prev, elements: [...prev.elements, newElement] }))
    setSelectedElementIds([newElement.id])
  }

  const deleteElement = (elementId: string) => {
    setTemplate((prev) => ({ ...prev, elements: prev.elements.filter((e) => e.id !== elementId) }))
    setSelectedElementIds((prev) => prev.filter((id) => id !== elementId))
  }

  const duplicateElement = (elementId: string) => {
    const element = template.elements.find((e) => e.id === elementId)
    if (!element) return
    const newElement: BadgeElement = {
      ...element,
      id: Date.now().toString(),
      x: element.x + 20,
      y: element.y + 20,
      zIndex: Math.max(...template.elements.map((e) => e.zIndex), 0) + 1,
    }
    setTemplate((prev) => ({ ...prev, elements: [...prev.elements, newElement] }))
    setSelectedElementIds([newElement.id])
  }

  // Keyboard shortcuts - must be after all function definitions it references
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); return }
      if ((e.ctrlKey || e.metaKey) && e.key === "c") { e.preventDefault(); copyElements(); return }
      if ((e.ctrlKey || e.metaKey) && e.key === "v") { e.preventDefault(); pasteElements(); return }
      if ((e.ctrlKey || e.metaKey) && e.key === "a") { e.preventDefault(); setSelectedElementIds(template.elements.map((el) => el.id)); return }
      if (selectedElementIds.length > 0) {
        if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); selectedElementIds.forEach((id) => deleteElement(id)); setSelectedElementIds([]) }
        if ((e.ctrlKey || e.metaKey) && e.key === "d") { e.preventDefault(); selectedElementIds.forEach((id) => duplicateElement(id)) }
        if (e.key === "]") { e.preventDefault(); bringToFront() }
        if (e.key === "[") { e.preventDefault(); sendToBack() }
        // Center alignment shortcuts
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "h") { e.preventDefault(); centerHorizontally() }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "v") { e.preventDefault(); centerVertically() }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "c") { e.preventDefault(); centerHorizontally(); centerVertically() }
        const step = e.shiftKey ? 10 : 1
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
          e.preventDefault()
          selectedElementIds.forEach((id) => {
            const element = template.elements.find((el) => el.id === id)
            if (element && !element.locked) {
              const updates: Partial<BadgeElement> = {}
              if (e.key === "ArrowUp") updates.y = Math.max(0, element.y - step)
              if (e.key === "ArrowDown") updates.y = element.y + step
              if (e.key === "ArrowLeft") updates.x = Math.max(0, element.x - step)
              if (e.key === "ArrowRight") updates.x = element.x + step
              updateElement(id, updates)
            }
          })
        }
      }
      if (e.key === "Escape") setSelectedElementIds([])
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedElementIds, template.elements, undo, redo, copyElements, pasteElements, bringToFront, sendToBack, centerHorizontally, centerVertically, updateElement, deleteElement, duplicateElement])

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const pngFile = await convertImageToPng(file)
      const fileName = `badge-templates/${eventId}/${Date.now()}.png`
      const { error } = await supabase.storage.from("event-assets").upload(fileName, pngFile, { contentType: "image/png" })
      if (error) throw error
      const { data: urlData } = supabase.storage.from("event-assets").getPublicUrl(fileName)
      setTemplate((prev) => ({ ...prev, backgroundImageUrl: urlData.publicUrl }))
      setHasUnsavedChanges(true)
      toast.success("Background uploaded!")
    } catch (error: any) {
      toast.error(error.message)
    }
    e.target.value = ""
  }

  const handleElementImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const targetElementId = selectedElementIds[0]
    if (!file || !targetElementId) return
    try {
      const pngFile = await convertImageToPng(file)
      const fileName = `badge-elements/${eventId}/${Date.now()}.png`
      const { error } = await supabase.storage.from("event-assets").upload(fileName, pngFile, { contentType: "image/png" })
      if (error) throw error
      const { data: urlData } = supabase.storage.from("event-assets").getPublicUrl(fileName)
      updateElement(targetElementId, { imageUrl: urlData.publicUrl })
      toast.success("Image uploaded!")
    } catch (error: any) {
      toast.error(error.message)
    }
    e.target.value = ""
  }

  const convertImageToPng = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        ctx?.drawImage(img, 0, 0)
        canvas.toBlob((blob) => {
          if (blob) resolve(new File([blob], "image.png", { type: "image/png" }))
          else reject(new Error("Failed to convert"))
        }, "image/png", 1.0)
      }
      img.onerror = () => reject(new Error("Failed to load image"))
      img.src = URL.createObjectURL(file)
    })
  }

  const saveTemplate = async () => {
    if (!template.name.trim()) { toast.error("Please enter a template name"); return }
    setIsSaving(true)
    try {
      const payload = {
        event_id: eventId,
        name: template.name,
        size: template.size,
        template_image_url: template.backgroundImageUrl,
        template_data: { backgroundColor: template.backgroundColor, elements: template.elements },
        ticket_type_ids: selectedTicketTypes.length > 0 ? selectedTicketTypes : null,
        is_default: selectedTicketTypes.length === 0,
        ...(savedTemplateId && { id: savedTemplateId, force_unlock: true }),
      }
      // Debug: Log what we're saving
      console.log("Saving template:", {
        name: payload.name,
        elements_count: template.elements.length,
        template_data: payload.template_data,
        method: savedTemplateId ? "PUT" : "POST",
      })
      const res = await fetch("/api/badge-templates", {
        method: savedTemplateId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error("Save failed:", data)
        throw new Error(data.error || "Failed to save")
      }
      // Debug: Log the response
      console.log("Save response:", {
        id: data.id,
        template_data_saved: !!data.template_data,
        elements_in_response: data.template_data?.elements?.length || 0,
      })
      setSavedTemplateId(data.id)
      setHasUnsavedChanges(false) // Mark as saved
      queryClient.invalidateQueries({ queryKey: ["badge-templates", eventId] })
      toast.success(`Template saved! (${template.elements.length} elements)`)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const loadTemplate = (t: any) => {
    // Parse template_data if it's a string (can happen with JSONB columns)
    let data = t.template_data || {}
    if (typeof data === "string") {
      try {
        data = JSON.parse(data)
      } catch (e) {
        console.error("Failed to parse template_data:", e)
        data = {}
      }
    }
    // Debug logging
    console.log("Loading template:", {
      id: t.id,
      name: t.name,
      template_data: data,
      template_data_type: typeof t.template_data,
      elements: data.elements,
      elements_count: data.elements?.length || 0,
    })
    setTemplate({
      id: t.id,
      name: t.name,
      size: t.size || "4x3",
      backgroundColor: data.backgroundColor || "#ffffff",
      backgroundImageUrl: t.template_image_url,
      elements: data.elements || [],
    })
    setSavedTemplateId(t.id)
    setHasUnsavedChanges(false) // Loaded template has no unsaved changes
    setSelectedTicketTypes(t.ticket_type_ids || [])
    setIsTemplateDialogOpen(false)

    // Show appropriate message based on elements
    if (!data.elements || data.elements.length === 0) {
      toast.warning(`Template "${t.name}" has no design elements. The design was not saved properly. Please add elements and save.`, { duration: 6000 })
    } else {
      toast.success(`Loaded: ${t.name} (${data.elements.length} elements)`)
    }
  }

  const deleteTemplateById = async (id: string) => {
    if (!confirm("Delete this template?")) return
    try {
      await fetch(`/api/badge-templates?id=${id}`, { method: "DELETE" })
      queryClient.invalidateQueries({ queryKey: ["badge-templates", eventId] })
      if (savedTemplateId === id) {
        setSavedTemplateId(null)
        setHasUnsavedChanges(true) // New template needs to be saved
        setTemplate({ id: "", name: "New Badge Template", size: "4x3", backgroundColor: "#ffffff", backgroundImageUrl: null, elements: [] })
      }
      toast.success("Deleted")
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  // Repair template - add default elements to empty template
  const repairTemplate = () => {
    const badgeSize = BADGE_SIZES[template.size] || BADGE_SIZES["4x3"]
    const width = badgeSize.width
    const height = badgeSize.height

    // Create default elements based on badge size
    const defaultElements: BadgeElement[] = [
      // Header background
      {
        id: `repair-${Date.now()}-0`,
        type: "shape",
        x: 0,
        y: 0,
        width: width,
        height: height * 0.22,
        backgroundColor: "#6366f1",
        shapeType: "rectangle",
        zIndex: 1,
        visible: true,
      },
      // Event name
      {
        id: `repair-${Date.now()}-1`,
        type: "text",
        x: 20,
        y: 15,
        width: width - 40,
        height: 30,
        content: "{{event_name}}",
        fontSize: 16,
        fontWeight: "bold",
        align: "center",
        color: "#ffffff",
        zIndex: 2,
        visible: true,
      },
      // Event date
      {
        id: `repair-${Date.now()}-2`,
        type: "text",
        x: 20,
        y: 45,
        width: width - 40,
        height: 20,
        content: "{{event_date}}",
        fontSize: 11,
        fontWeight: "normal",
        align: "center",
        color: "#e0e7ff",
        zIndex: 2,
        visible: true,
      },
      // Name
      {
        id: `repair-${Date.now()}-3`,
        type: "text",
        x: 20,
        y: height * 0.28,
        width: width - 40,
        height: 45,
        content: "{{name}}",
        fontSize: 26,
        fontWeight: "bold",
        align: "center",
        color: "#1e1b4b",
        zIndex: 1,
        visible: true,
        textCase: "uppercase",
      },
      // Ticket type badge
      {
        id: `repair-${Date.now()}-4`,
        type: "shape",
        x: width * 0.15,
        y: height * 0.48,
        width: width * 0.7,
        height: 32,
        backgroundColor: "#6366f1",
        borderRadius: 16,
        shapeType: "rectangle",
        zIndex: 1,
        visible: true,
      },
      {
        id: `repair-${Date.now()}-5`,
        type: "text",
        x: width * 0.15,
        y: height * 0.48 + 6,
        width: width * 0.7,
        height: 24,
        content: "{{ticket_type}}",
        fontSize: 14,
        fontWeight: "bold",
        align: "center",
        color: "#ffffff",
        zIndex: 2,
        visible: true,
        textCase: "uppercase",
      },
      // QR Code
      {
        id: `repair-${Date.now()}-6`,
        type: "qr_code",
        x: (width - 90) / 2,
        y: height * 0.62,
        width: 90,
        height: 90,
        content: "{{checkin_url}}",
        zIndex: 1,
        visible: true,
      },
      // Registration number
      {
        id: `repair-${Date.now()}-7`,
        type: "text",
        x: 20,
        y: height - 35,
        width: width - 40,
        height: 20,
        content: "{{registration_number}}",
        fontSize: 12,
        fontWeight: "bold",
        align: "center",
        color: "#6366f1",
        zIndex: 1,
        visible: true,
      },
      // Footer line
      {
        id: `repair-${Date.now()}-8`,
        type: "shape",
        x: 0,
        y: height - 12,
        width: width,
        height: 12,
        backgroundColor: "#6366f1",
        shapeType: "rectangle",
        zIndex: 1,
        visible: true,
      },
    ]

    setTemplate((prev) => ({
      ...prev,
      backgroundColor: "#ffffff",
      elements: defaultElements,
    }))
    setHasUnsavedChanges(true)
    toast.success("Template repaired with default design! Click Save to keep changes.")
  }

  // Check if template needs repair (has no elements)
  const needsRepair = template.elements.length === 0 && savedTemplateId

  const generatePdf = async () => {
    if (!savedTemplateId) { toast.error("Please save the template first"); return }
    setIsGeneratingPdf(true)
    try {
      let filteredRegs
      if (printFilter === "all") {
        // If template has assigned ticket types, only include those registrations
        if (selectedTicketTypes.length > 0) {
          filteredRegs = registrations?.filter((r: any) => selectedTicketTypes.includes(r.ticket_type_id))
        } else {
          filteredRegs = registrations
        }
      } else {
        filteredRegs = registrations?.filter((r: any) => r.ticket_type_id === printFilter)
      }
      if (!filteredRegs?.length) { toast.error("No registrations to generate"); return }

      const res = await fetch("/api/badges/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          template_id: savedTemplateId,
          registration_ids: filteredRegs.map((r: any) => r.id),
          badges_per_page: badgesPerPage,
        }),
      })
      if (!res.ok) throw new Error("Failed to generate")
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `badges-${event?.short_name || "event"}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success(`Generated ${filteredRegs.length} badges!`)
      setIsPrintDialogOpen(false)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const applyTextCase = (text: string, textCase?: string) => {
    if (!text) return text
    switch (textCase) {
      case "uppercase": return text.toUpperCase()
      case "lowercase": return text.toLowerCase()
      case "capitalize": return text.toLowerCase().replace(/(?:^|[\s.])([a-z])/g, (match) => match.toUpperCase())
      default: return text
    }
  }

  const renderElement = (element: BadgeElement) => {
    const isSelected = selectedElementIds.includes(element.id)
    const rawContent = previewMode ? replacePlaceholders(element.content || "", currentRegistration) : element.content || ""
    const content = element.type === "text" ? applyTextCase(rawContent, element.textCase) : rawContent
    const rotation = element.rotation || 0

    // Get gradient background style
    const getGradientStyle = (el: BadgeElement): string | undefined => {
      if (el.gradient?.enabled && el.gradient.colors.length >= 2) {
        if (el.gradient.type === "radial") {
          return `radial-gradient(circle, ${el.gradient.colors.join(", ")})`
        }
        return `linear-gradient(${el.gradient.angle || 0}deg, ${el.gradient.colors.join(", ")})`
      }
      return undefined
    }

    const elementContent = () => {
      if (element.type === "qr_code") {
        return <QRCodePreview value={previewMode ? replacePlaceholders(element.content || "", currentRegistration) : "PREVIEW-QR"} size={Math.min(element.width, element.height) * zoom} />
      }
      if (element.type === "barcode") {
        return <BarcodePreview value={previewMode ? replacePlaceholders(element.content || "", currentRegistration) : "PREVIEW123"} format={element.barcodeFormat || "CODE128"} width={element.width * zoom} height={element.height * zoom} />
      }
      if (element.type === "photo") {
        return element.imageUrl ? (
          <img src={element.imageUrl} alt="" className="w-full h-full object-cover" style={{ borderRadius: element.borderRadius || 0, borderWidth: element.borderWidth || 0, borderColor: element.borderColor || "transparent", borderStyle: "solid" }} />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300" style={{ borderRadius: element.borderRadius || 0 }}>
            <UserCircle className="h-8 w-8" />
          </div>
        )
      }
      if (element.type === "shape") {
        const gradientBg = getGradientStyle(element)
        if (element.shapeType === "triangle") {
          return (
            <div className="w-full h-full flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
                <polygon points="50,0 100,100 0,100" fill={element.backgroundColor || "#e5e7eb"} />
              </svg>
            </div>
          )
        }
        if (element.shapeType === "circle") {
          return (
            <div className="w-full h-full rounded-full" style={{
              backgroundColor: gradientBg ? undefined : (element.backgroundColor || "#e5e7eb"),
              backgroundImage: gradientBg,
              borderWidth: element.borderWidth || 0,
              borderColor: element.borderColor || "transparent",
              borderStyle: "solid",
            }} />
          )
        }
        return (
          <div className="w-full h-full" style={{
            backgroundColor: gradientBg ? undefined : (element.backgroundColor || "#e5e7eb"),
            backgroundImage: gradientBg,
            borderRadius: element.borderRadius || 0,
            borderWidth: element.borderWidth || 0,
            borderColor: element.borderColor || "transparent",
            borderStyle: "solid",
          }} />
        )
      }
      if (element.type === "image") {
        return element.imageUrl ? (
          <img src={element.imageUrl} alt="" className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded">
            <ImageIcon className="h-6 w-6" />
          </div>
        )
      }
      if (element.type === "line") {
        return (
          <div className="w-full flex items-center justify-center" style={{ height: element.height * zoom }}>
            <div className="w-full" style={{
              height: Math.max(1, element.height) * zoom,
              backgroundColor: element.color || "#000000",
              backgroundImage: element.lineStyle !== "solid"
                ? `repeating-linear-gradient(90deg, ${element.color || "#000000"} 0px, ${element.color || "#000000"} ${element.lineStyle === "dashed" ? "8px" : "2px"}, transparent ${element.lineStyle === "dashed" ? "8px" : "2px"}, transparent ${element.lineStyle === "dashed" ? "12px" : "4px"})`
                : "none",
            }} />
          </div>
        )
      }
      const shadowStyle = element.shadowEnabled ? `${element.shadowOffsetX || 2}px ${element.shadowOffsetY || 2}px ${element.shadowBlur || 4}px ${element.shadowColor || "rgba(0,0,0,0.3)"}` : "none"
      return (
        <div className="w-full h-full flex items-center overflow-hidden whitespace-pre-wrap" style={{
          fontSize: (element.fontSize || 14) * zoom,
          fontFamily: element.fontFamily || "Arial, sans-serif",
          fontWeight: element.fontWeight || "normal",
          fontStyle: element.fontStyle || "normal",
          color: element.color || "#000000",
          textAlign: element.align || "left",
          justifyContent: element.align === "center" ? "center" : element.align === "right" ? "flex-end" : "flex-start",
          backgroundColor: element.backgroundColor || "transparent",
          lineHeight: element.lineHeight || 1.3,
          letterSpacing: element.letterSpacing ? `${element.letterSpacing}px` : "normal",
          textShadow: shadowStyle,
          borderWidth: element.borderWidth || 0,
          borderColor: element.borderColor || "transparent",
          borderStyle: element.borderWidth ? "solid" : "none",
          borderRadius: element.borderRadius || 0,
        }}>
          {content}
        </div>
      )
    }

    if (previewMode) {
      return (
        <div key={element.id} className="absolute" style={{
          left: element.x * zoom,
          top: element.y * zoom,
          width: element.width * zoom,
          height: element.height * zoom,
          zIndex: element.zIndex,
          opacity: (element.opacity ?? 100) / 100,
          transform: rotation ? `rotate(${rotation}deg)` : undefined,
          transformOrigin: "center center",
        }}>
          {elementContent()}
        </div>
      )
    }

    return (
      <Rnd
        key={element.id}
        size={{ width: element.width * zoom, height: element.height * zoom }}
        position={{ x: element.x * zoom, y: element.y * zoom }}
        onDragStop={(e, d) => {
          const { snapX, snapY } = calculateSnapGuides(element.id, d.x / zoom, d.y / zoom, element.width, element.height)
          updateElement(element.id, { x: Math.max(0, Math.round(snapX)), y: Math.max(0, Math.round(snapY)) })
          setSnapGuides({ horizontal: [], vertical: [] })
        }}
        onDrag={(e, d) => {
          const { guides } = calculateSnapGuides(element.id, d.x / zoom, d.y / zoom, element.width, element.height)
          setSnapGuides(guides)
        }}
        onResizeStop={(e, direction, ref, delta, position) => updateElement(element.id, {
          width: Math.round(parseInt(ref.style.width) / zoom),
          height: Math.round(parseInt(ref.style.height) / zoom),
          x: Math.max(0, Math.round(position.x / zoom)),
          y: Math.max(0, Math.round(position.y / zoom)),
        })}
        onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleElementSelect(element.id, e) }}
        onContextMenu={(e: React.MouseEvent) => {
          e.preventDefault(); e.stopPropagation()
          setSelectedElementIds([element.id])
          setContextMenu({ x: e.clientX, y: e.clientY, elementId: element.id })
        }}
        bounds="parent"
        className={cn("group", isSelected ? "ring-2 ring-primary ring-offset-1" : "hover:ring-1 hover:ring-primary/50", element.locked && "cursor-not-allowed")}
        style={{ zIndex: element.zIndex, opacity: (element.opacity ?? 100) / 100, transform: rotation ? `rotate(${rotation}deg)` : undefined, transformOrigin: "center center" }}
        enableResizing={isSelected && !element.locked}
        disableDragging={element.locked}
      >
        {elementContent()}
        {element.locked && <div className="absolute top-1 right-1 bg-black/60 rounded p-0.5"><Lock className="h-3 w-3 text-white" /></div>}
      </Rnd>
    )
  }

  if (!mounted) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading Badge Designer...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full bg-muted/30">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBackgroundUpload} />
      <input ref={elementImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleElementImageUpload} />

      {/* Left Sidebar */}
      <div className="w-72 bg-background border-r flex flex-col">
        {/* Tabs */}
        <div className="flex border-b">
          {[
            { id: "elements" as const, icon: LayoutGrid, label: "Elements" },
            { id: "design" as const, icon: Palette, label: "Design" },
            { id: "layers" as const, icon: Layers, label: "Layers" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setLeftTab(tab.id)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                leftTab === tab.id ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto">
          {/* Elements Tab */}
          {leftTab === "elements" && (
            <div className="p-4 space-y-5">
              {/* Dynamic Fields */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dynamic Fields</h3>
                <p className="text-xs text-muted-foreground mb-3">Click to add data placeholders</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {PREDEFINED_FIELDS.map((field) => {
                    const IconComponent = field.icon
                    return (
                      <button
                        key={field.key}
                        onClick={() => addPredefinedField(field)}
                        className="flex flex-col items-center gap-1.5 p-2 rounded-lg border bg-background hover:bg-primary/5 hover:border-primary/50 hover:shadow-sm transition-all text-center group"
                        title={`Add ${field.label}`}
                      >
                        <IconComponent className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground leading-tight">{field.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t" />

              {/* Elements */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Design Elements</h3>
                <p className="text-xs text-muted-foreground mb-3">Add shapes, images & more</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={addQRCode} className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-primary/5 hover:border-primary/50 hover:shadow-sm transition-all group">
                    <div className="p-2 rounded-md bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <QrCode className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-xs font-medium">QR Code</span>
                  </button>
                  <button onClick={addBarcode} className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-primary/5 hover:border-primary/50 hover:shadow-sm transition-all group">
                    <div className="p-2 rounded-md bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                      <Barcode className="h-4 w-4 text-orange-500" />
                    </div>
                    <span className="text-xs font-medium">Barcode</span>
                  </button>
                  <button onClick={() => addShape("rectangle")} className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-primary/5 hover:border-primary/50 hover:shadow-sm transition-all group">
                    <div className="p-2 rounded-md bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                      <Square className="h-4 w-4 text-blue-500" />
                    </div>
                    <span className="text-xs font-medium">Rectangle</span>
                  </button>
                  <button onClick={() => addShape("circle")} className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-primary/5 hover:border-primary/50 hover:shadow-sm transition-all group">
                    <div className="p-2 rounded-md bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                      <Circle className="h-4 w-4 text-purple-500" />
                    </div>
                    <span className="text-xs font-medium">Circle</span>
                  </button>
                  <button onClick={() => addShape("rounded")} className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-primary/5 hover:border-primary/50 hover:shadow-sm transition-all group">
                    <div className="p-2 rounded-md bg-teal-500/10 group-hover:bg-teal-500/20 transition-colors">
                      <RectangleHorizontal className="h-4 w-4 text-teal-500" />
                    </div>
                    <span className="text-xs font-medium">Rounded</span>
                  </button>
                  <button onClick={() => addShape("triangle")} className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-primary/5 hover:border-primary/50 hover:shadow-sm transition-all group">
                    <div className="p-2 rounded-md bg-pink-500/10 group-hover:bg-pink-500/20 transition-colors">
                      <Triangle className="h-4 w-4 text-pink-500" />
                    </div>
                    <span className="text-xs font-medium">Triangle</span>
                  </button>
                  <button onClick={addLine} className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-primary/5 hover:border-primary/50 hover:shadow-sm transition-all group">
                    <div className="p-2 rounded-md bg-gray-500/10 group-hover:bg-gray-500/20 transition-colors">
                      <Minus className="h-4 w-4 text-gray-500" />
                    </div>
                    <span className="text-xs font-medium">Line</span>
                  </button>
                  <button onClick={addImage} className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-primary/5 hover:border-primary/50 hover:shadow-sm transition-all group">
                    <div className="p-2 rounded-md bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                      <ImageIcon className="h-4 w-4 text-green-500" />
                    </div>
                    <span className="text-xs font-medium">Image</span>
                  </button>
                  <button onClick={addPhoto} className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-primary/5 hover:border-primary/50 hover:shadow-sm transition-all group">
                    <div className="p-2 rounded-md bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
                      <UserCircle className="h-4 w-4 text-cyan-500" />
                    </div>
                    <span className="text-xs font-medium">Photo</span>
                  </button>
                </div>
                <button
                  onClick={() => addPredefinedField({ key: "custom", label: "Custom", icon: Type, placeholder: "Custom Text", defaultSize: { w: 150, h: 30 }, fontSize: 14, fontWeight: "normal" })}
                  className="w-full mt-2 flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <Type className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                  <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">Add Custom Text</span>
                </button>
              </div>

              {/* Pre-built Templates */}
              <div className="border-t pt-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quick Start</h3>
                <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setIsPreBuiltDialogOpen(true)}>
                  <Wand2 className="h-4 w-4" />
                  Browse Pre-built Templates
                </Button>
              </div>

              {/* Tip */}
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <div className="flex gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    <strong>Tip:</strong> Use <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900">{"{{name}}"}</code> placeholders for dynamic content that changes per badge.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Design Tab */}
          {leftTab === "design" && (
            <div className="p-4 space-y-6">
              {/* Template Name */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Template Name</Label>
                <Input
                  value={template.name}
                  onChange={(e) => { setTemplate((p) => ({ ...p, name: e.target.value })); setHasUnsavedChanges(true) }}
                  className="mt-2"
                  placeholder="Enter template name"
                />
              </div>

              {/* Badge Size */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Badge Size</Label>
                <Select value={template.size} onValueChange={(v: keyof typeof BADGE_SIZES) => { setTemplate((p) => ({ ...p, size: v })); setHasUnsavedChanges(true) }}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(BADGE_SIZES).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Background */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Background</Label>
                <div className="mt-2 space-y-3">
                  <div className="flex gap-2">
                    <div className="relative">
                      <input
                        type="color"
                        value={template.backgroundColor}
                        onChange={(e) => { setTemplate((p) => ({ ...p, backgroundColor: e.target.value })); setHasUnsavedChanges(true) }}
                        className="h-10 w-14 rounded-lg border cursor-pointer"
                      />
                    </div>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-2" />
                      Image
                    </Button>
                  </div>
                  {template.backgroundImageUrl && (
                    <div className="relative group rounded-lg overflow-hidden border">
                      <img src={template.backgroundImageUrl} alt="" className="w-full h-24 object-cover" />
                      <button
                        onClick={() => { setTemplate((p) => ({ ...p, backgroundImageUrl: null })); setHasUnsavedChanges(true) }}
                        className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Ticket Types */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assign to Ticket Types</Label>
                <p className="text-xs text-muted-foreground mt-1">Leave empty for all</p>
                <div className="mt-2 space-y-2 max-h-40 overflow-auto p-3 bg-muted/50 rounded-lg">
                  {ticketTypes?.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">No ticket types</p>
                  ) : (
                    ticketTypes?.map((t: any) => (
                      <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedTicketTypes.includes(t.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedTicketTypes([...selectedTicketTypes, t.id])
                            else setSelectedTicketTypes(selectedTicketTypes.filter((id) => id !== t.id))
                            setHasUnsavedChanges(true)
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="truncate">{t.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Layers Tab */}
          {leftTab === "layers" && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Layers ({template.elements.length})
                </h3>
              </div>
              <div className="space-y-1">
                {template.elements.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No elements yet</p>
                  </div>
                ) : (
                  [...template.elements].sort((a, b) => b.zIndex - a.zIndex).map((element) => {
                    const isSelected = selectedElementIds.includes(element.id)
                    const ElementIcon = element.type === "text" ? Type : element.type === "qr_code" ? QrCode : element.type === "image" ? ImageIcon : element.type === "line" ? Minus : Square
                    const name = element.type === "text" ? (element.content?.substring(0, 15) || "Text") : element.type === "qr_code" ? "QR Code" : element.type === "image" ? "Image" : element.type === "line" ? "Line" : "Shape"

                    return (
                      <div
                        key={element.id}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all text-sm group",
                          isSelected ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted",
                          element.visible === false && "opacity-50"
                        )}
                        onClick={(e) => handleElementSelect(element.id, e)}
                      >
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 cursor-grab" />
                        <ElementIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="flex-1 truncate text-foreground">{name}</span>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); toggleVisibility(element.id) }} className="p-1 rounded hover:bg-muted-foreground/10">
                            {element.visible === false ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); updateElement(element.id, { locked: !element.locked }) }} className="p-1 rounded hover:bg-muted-foreground/10">
                            {element.locked ? <Lock className="h-3.5 w-3.5 text-amber-500" /> : <Unlock className="h-3.5 w-3.5" />}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deleteElement(element.id) }} className="p-1 rounded hover:bg-destructive/10 text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-12 bg-background border-b flex items-center justify-between px-3 gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setIsTemplateDialogOpen(true)} className="gap-2">
              <FolderOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Templates</span>
              {savedTemplates?.length > 0 && <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{savedTemplates.length}</span>}
            </Button>
            <div className="h-4 w-px bg-border mx-1" />
            <Button variant="ghost" size="icon" onClick={undo} disabled={historyIndex <= 0} title="Undo (Ctrl+Z)"><Undo2 className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo (Ctrl+Y)"><Redo2 className="h-4 w-4" /></Button>
            <div className="h-4 w-px bg-border mx-1" />
            <Button variant={showGrid ? "secondary" : "ghost"} size="icon" onClick={() => setShowGrid(!showGrid)} title="Toggle Grid"><Grid3X3 className="h-4 w-4" /></Button>
            <Button variant={snapEnabled ? "secondary" : "ghost"} size="icon" onClick={() => setSnapEnabled(!snapEnabled)} title="Toggle Smart Guides"><AlignHorizontalJustifyCenter className="h-4 w-4" /></Button>
            <div className="h-4 w-px bg-border mx-1" />
            {/* Quick Center Buttons */}
            <Button variant="ghost" size="icon" onClick={centerHorizontally} disabled={selectedElementIds.length === 0} title="Center Horizontally (Ctrl+Shift+H)"><AlignHorizontalJustifyCenter className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={centerVertically} disabled={selectedElementIds.length === 0} title="Center Vertically (Ctrl+Shift+V)"><AlignVerticalJustifyCenter className="h-4 w-4" /></Button>
            <div className="h-4 w-px bg-border mx-1" />
            <div className="flex items-center gap-0.5 bg-muted rounded-md px-1 py-0.5">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} title="Zoom Out"><ZoomOut className="h-3.5 w-3.5" /></Button>
              <button
                onClick={() => setZoom(1)}
                className="text-xs w-12 text-center font-medium hover:bg-background rounded px-1 py-0.5 transition-colors"
                title="Reset to 100%"
              >
                {Math.round(zoom * 100)}%
              </button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoom((z) => Math.min(2, z + 0.1))} title="Zoom In"><ZoomIn className="h-3.5 w-3.5" /></Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant={previewMode ? "default" : "outline"} size="sm" onClick={() => setPreviewMode(!previewMode)} className="gap-2">
              <Eye className="h-4 w-4" />
              {previewMode ? "Edit" : "Preview"}
            </Button>
            <Button
              variant={hasUnsavedChanges ? "outline" : "secondary"}
              size="sm"
              onClick={saveTemplate}
              disabled={isSaving || !hasUnsavedChanges}
              className={`gap-2 ${!hasUnsavedChanges ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : ""}`}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : hasUnsavedChanges ? (
                <Save className="h-4 w-4" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              {hasUnsavedChanges ? "Save" : "Saved"}
            </Button>
            <Button size="sm" onClick={() => setIsPrintDialogOpen(true)} className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto" onClick={() => { setSelectedElementIds([]); setContextMenu(null) }}>
          <div className="min-h-full min-w-full flex items-center justify-center p-8">
            {/* Ruler Guides */}
            {showRulers && !previewMode && (
              <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none flex items-center justify-center">
                {/* Top Ruler */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 bg-muted/50 border-b flex items-end overflow-hidden" style={{ width: badgeSize.width * zoom + 40 }}>
                  <div className="flex-1 relative h-4" style={{ marginLeft: 20, marginRight: 20 }}>
                    {Array.from({ length: Math.ceil(badgeSize.width / 50) + 1 }, (_, i) => (
                      <div key={i} className="absolute bottom-0 flex flex-col items-center" style={{ left: i * 50 * zoom }}>
                        <span className="text-[8px] text-muted-foreground mb-0.5">{i * 50}</span>
                        <div className="w-px h-2 bg-muted-foreground/50" />
                      </div>
                    ))}
                  </div>
                </div>
                {/* Left Ruler */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-6 bg-muted/50 border-r flex items-center overflow-hidden" style={{ height: badgeSize.height * zoom + 40 }}>
                  <div className="flex-1 relative w-4 h-full" style={{ marginTop: 20, marginBottom: 20 }}>
                    {Array.from({ length: Math.ceil(badgeSize.height / 50) + 1 }, (_, i) => (
                      <div key={i} className="absolute left-0 flex flex-row items-center" style={{ top: i * 50 * zoom }}>
                        <span className="text-[8px] text-muted-foreground mr-0.5 -rotate-90 origin-right">{i * 50}</span>
                        <div className="h-px w-2 bg-muted-foreground/50" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div
              ref={canvasRef}
              className="relative shadow-xl rounded-sm"
              style={{
                width: badgeSize.width * zoom,
                height: badgeSize.height * zoom,
                backgroundColor: template.backgroundColor,
              }}
            >
              {template.backgroundImageUrl && (
                <img src={template.backgroundImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ zIndex: 0 }} />
              )}
              {showGrid && !previewMode && (
                <div className="absolute inset-0 pointer-events-none" style={{
                  backgroundImage: "linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)",
                  backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
                  zIndex: 998,
                }} />
              )}
              {/* Snap Guides - Multiple lines for element-to-element alignment */}
              {!previewMode && snapEnabled && snapGuides.vertical.map((x, i) => (
                <div key={`v-${i}`} className="absolute top-0 bottom-0 w-px bg-primary/80 pointer-events-none" style={{ left: x * zoom, zIndex: 999 }}>
                  <div className="absolute top-2 left-1 bg-primary text-[10px] text-white px-1 rounded">{Math.round(x)}</div>
                </div>
              ))}
              {!previewMode && snapEnabled && snapGuides.horizontal.map((y, i) => (
                <div key={`h-${i}`} className="absolute left-0 right-0 h-px bg-primary/80 pointer-events-none" style={{ top: y * zoom, zIndex: 999 }}>
                  <div className="absolute left-2 top-1 bg-primary text-[10px] text-white px-1 rounded">{Math.round(y)}</div>
                </div>
              ))}
              {/* Center crosshair guides */}
              {!previewMode && showGrid && (
                <>
                  <div className="absolute top-0 bottom-0 w-px bg-primary/20 pointer-events-none" style={{ left: "50%", zIndex: 997 }} />
                  <div className="absolute left-0 right-0 h-px bg-primary/20 pointer-events-none" style={{ top: "50%", zIndex: 997 }} />
                </>
              )}
              {template.elements.sort((a, b) => a.zIndex - b.zIndex).map(renderElement)}
              {template.elements.length === 0 && !previewMode && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    {needsRepair ? (
                      <>
                        <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-amber-500" />
                        <p className="font-medium text-amber-600">Template has no design</p>
                        <p className="text-sm text-muted-foreground mb-4">The design was not saved properly</p>
                        <button
                          onClick={repairTemplate}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-sm flex items-center gap-2 mx-auto"
                        >
                          <Wand2 className="h-4 w-4" />
                          Repair with Default Design
                        </button>
                        <p className="text-xs text-muted-foreground mt-3">Or add elements manually from the left panel</p>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">Start designing</p>
                        <p className="text-sm text-muted-foreground">Add elements from the left panel</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preview Navigation - Always visible in preview mode */}
        {previewMode && (
          <div className="bg-background border-t">
            {/* Search Bar - Prominent */}
            <div className="px-4 py-3 border-b bg-muted/30">
              <div className="max-w-md mx-auto">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search registrations by name, number, email..."
                    value={previewSearch}
                    onChange={(e) => {
                      setPreviewSearch(e.target.value)
                      setPreviewIndex(0)
                    }}
                    className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border-2 bg-background focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    autoFocus
                  />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {previewSearch && (
                    <button
                      onClick={() => { setPreviewSearch(""); setPreviewIndex(0) }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {previewSearch && (
                  <p className="text-xs text-center mt-2 text-muted-foreground">
                    Found <strong className="text-foreground">{filteredRegistrations.length}</strong> of {registrations?.length || 0} registrations
                  </p>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="h-12 flex items-center justify-center gap-4 px-4">
              <Button variant="outline" size="sm" onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))} disabled={previewIndex === 0 || filteredRegistrations.length === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center min-w-[200px]">
                {filteredRegistrations.length > 0 ? (
                  <>
                    <p className="text-sm font-medium truncate">{currentRegistration?.attendee_name}</p>
                    <p className="text-xs text-muted-foreground">{currentRegistration?.registration_number} • {previewIndex + 1} of {filteredRegistrations.length}</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No registrations {previewSearch ? "matching search" : "found"}</p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setPreviewIndex((i) => Math.min(filteredRegistrations.length - 1, i + 1))} disabled={previewIndex >= filteredRegistrations.length - 1 || filteredRegistrations.length === 0}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Right Properties Panel */}
      <div className="w-72 bg-background border-l flex flex-col">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Properties</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedElementIds.length > 1 ? `${selectedElementIds.length} elements` : selectedElement ? `${selectedElement.type} element` : "Select an element"}
          </p>
        </div>

        {/* Multi-select actions */}
        {selectedElementIds.length > 1 && (
          <div className="p-4 border-b space-y-4">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Align</Label>
              <div className="grid grid-cols-6 gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => alignElements("left")} title="Align Left"><AlignStartVertical className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => alignElements("center")} title="Align Center H"><AlignHorizontalJustifyCenter className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => alignElements("right")} title="Align Right"><AlignEndVertical className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => alignElements("top")} title="Align Top"><AlignStartHorizontal className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => alignElements("middle")} title="Align Middle"><AlignVerticalJustifyCenter className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => alignElements("bottom")} title="Align Bottom"><AlignEndHorizontal className="h-4 w-4" /></Button>
              </div>
            </div>
            {selectedElementIds.length >= 3 && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Distribute</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => distributeElements("horizontal")} className="gap-1"><AlignHorizontalSpaceAround className="h-4 w-4" />H</Button>
                  <Button variant="outline" size="sm" onClick={() => distributeElements("vertical")} className="gap-1"><AlignVerticalSpaceAround className="h-4 w-4" />V</Button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => selectedElementIds.forEach((id) => duplicateElement(id))}><Copy className="h-4 w-4 mr-1" />Duplicate</Button>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => { selectedElementIds.forEach((id) => deleteElement(id)); setSelectedElementIds([]) }}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
            </div>
          </div>
        )}

        {selectedElement ? (
          <div className="flex-1 overflow-auto p-4 space-y-5">
            {/* Position & Size */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Position & Size</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div><Label className="text-xs">X</Label><Input type="number" value={selectedElement.x} onChange={(e) => updateElement(selectedElement.id, { x: parseInt(e.target.value) || 0 })} className="mt-1 h-8" /></div>
                <div><Label className="text-xs">Y</Label><Input type="number" value={selectedElement.y} onChange={(e) => updateElement(selectedElement.id, { y: parseInt(e.target.value) || 0 })} className="mt-1 h-8" /></div>
                <div><Label className="text-xs">W</Label><Input type="number" value={selectedElement.width} onChange={(e) => updateElement(selectedElement.id, { width: parseInt(e.target.value) || 0 })} className="mt-1 h-8" /></div>
                <div><Label className="text-xs">H</Label><Input type="number" value={selectedElement.height} onChange={(e) => updateElement(selectedElement.id, { height: parseInt(e.target.value) || 0 })} className="mt-1 h-8" /></div>
              </div>
            </div>

            {/* Rotation */}
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rotation</Label>
                <span className="text-xs text-muted-foreground">{selectedElement.rotation || 0}°</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input type="range" min="0" max="360" value={selectedElement.rotation || 0} onChange={(e) => updateElement(selectedElement.id, { rotation: parseInt(e.target.value) })} className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer" />
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateElement(selectedElement.id, { rotation: ((selectedElement.rotation || 0) + 90) % 360 })} title="Rotate 90°">
                  <RotateCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Barcode Content */}
            {selectedElement.type === "barcode" && (
              <>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Barcode Content</Label>
                  <Input value={selectedElement.content || ""} onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })} className="mt-2 h-8" placeholder="{{registration_number}}" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Format</Label>
                  <Select value={selectedElement.barcodeFormat || "CODE128"} onValueChange={(v: "CODE128" | "CODE39" | "EAN13" | "UPC") => updateElement(selectedElement.id, { barcodeFormat: v })}>
                    <SelectTrigger className="mt-2 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CODE128">Code 128</SelectItem>
                      <SelectItem value="CODE39">Code 39</SelectItem>
                      <SelectItem value="EAN13">EAN-13</SelectItem>
                      <SelectItem value="UPC">UPC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Photo Properties */}
            {selectedElement.type === "photo" && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Photo Placeholder</Label>
                <div className="mt-2 space-y-2">
                  <Button variant="outline" size="sm" className="w-full" onClick={() => elementImageInputRef.current?.click()}><Upload className="h-4 w-4 mr-2" />Upload Photo</Button>
                  <p className="text-xs text-muted-foreground text-center">This shows a placeholder for attendee photos</p>
                </div>
              </div>
            )}

            {/* Text Content */}
            {(selectedElement.type === "text" || selectedElement.type === "qr_code") && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</Label>
                <Input value={selectedElement.content || ""} onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })} className="mt-2 h-8" placeholder="Text or {{placeholder}}" />
              </div>
            )}

            {/* Text Properties */}
            {selectedElement.type === "text" && (
              <>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Typography</Label>
                  <Select value={selectedElement.fontFamily || "Arial, sans-serif"} onValueChange={(v) => updateElement(selectedElement.id, { fontFamily: v })}>
                    <SelectTrigger className="mt-2 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{FONT_OPTIONS.map((f) => (<SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</SelectItem>))}</SelectContent>
                  </Select>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div><Label className="text-xs">Size</Label><Input type="number" value={selectedElement.fontSize || 14} onChange={(e) => updateElement(selectedElement.id, { fontSize: parseInt(e.target.value) || 14 })} className="mt-1 h-8" /></div>
                    <div><Label className="text-xs">Line H</Label><Input type="number" step="0.1" value={selectedElement.lineHeight || 1.3} onChange={(e) => updateElement(selectedElement.id, { lineHeight: parseFloat(e.target.value) || 1.3 })} className="mt-1 h-8" /></div>
                    <div><Label className="text-xs">Spacing</Label><Input type="number" value={selectedElement.letterSpacing || 0} onChange={(e) => updateElement(selectedElement.id, { letterSpacing: parseInt(e.target.value) || 0 })} className="mt-1 h-8" /></div>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</Label>
                  <div className="flex gap-1 mt-2">
                    <Button variant={selectedElement.fontWeight === "bold" ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => updateElement(selectedElement.id, { fontWeight: selectedElement.fontWeight === "bold" ? "normal" : "bold" })}><Bold className="h-4 w-4" /></Button>
                    <Button variant={selectedElement.fontStyle === "italic" ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => updateElement(selectedElement.id, { fontStyle: selectedElement.fontStyle === "italic" ? "normal" : "italic" })}><Italic className="h-4 w-4" /></Button>
                    <div className="h-8 w-px bg-border mx-1" />
                    <Button variant={selectedElement.align === "left" ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => updateElement(selectedElement.id, { align: "left" })}><AlignLeft className="h-4 w-4" /></Button>
                    <Button variant={selectedElement.align === "center" ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => updateElement(selectedElement.id, { align: "center" })}><AlignCenter className="h-4 w-4" /></Button>
                    <Button variant={selectedElement.align === "right" ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => updateElement(selectedElement.id, { align: "right" })}><AlignRight className="h-4 w-4" /></Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Text Case</Label>
                  <Select value={selectedElement.textCase || "none"} onValueChange={(v: "none" | "uppercase" | "lowercase" | "capitalize") => updateElement(selectedElement.id, { textCase: v })}>
                    <SelectTrigger className="mt-2 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">As Entered</SelectItem>
                      <SelectItem value="uppercase">UPPERCASE</SelectItem>
                      <SelectItem value="lowercase">lowercase</SelectItem>
                      <SelectItem value="capitalize">Title Case</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Color</Label>
                  <div className="flex gap-2 mt-2">
                    <input type="color" value={selectedElement.color || "#000000"} onChange={(e) => updateElement(selectedElement.id, { color: e.target.value })} className="h-8 w-10 rounded border cursor-pointer" />
                    <Input value={selectedElement.color || "#000000"} onChange={(e) => updateElement(selectedElement.id, { color: e.target.value })} className="flex-1 h-8" />
                  </div>
                </div>
              </>
            )}

            {/* Shape Properties */}
            {selectedElement.type === "shape" && (
              <>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fill</Label>
                  <div className="flex gap-2 mt-2">
                    <input type="color" value={selectedElement.backgroundColor || "#e5e7eb"} onChange={(e) => updateElement(selectedElement.id, { backgroundColor: e.target.value })} className="h-8 w-10 rounded border cursor-pointer" />
                    <Input value={selectedElement.backgroundColor || "#e5e7eb"} onChange={(e) => updateElement(selectedElement.id, { backgroundColor: e.target.value })} className="flex-1 h-8" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gradient</Label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={selectedElement.gradient?.enabled || false} onChange={(e) => updateElement(selectedElement.id, { gradient: { ...selectedElement.gradient, enabled: e.target.checked, type: "linear", colors: [selectedElement.backgroundColor || "#3b82f6", "#8b5cf6"], angle: 135 } })} className="rounded border-gray-300" />
                    </label>
                  </div>
                  {selectedElement.gradient?.enabled && (
                    <div className="mt-2 space-y-2 p-2 bg-muted/50 rounded-lg">
                      <Select value={selectedElement.gradient?.type || "linear"} onValueChange={(v: "linear" | "radial") => updateElement(selectedElement.id, { gradient: { ...selectedElement.gradient!, type: v } })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="linear">Linear</SelectItem>
                          <SelectItem value="radial">Radial</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Color 1</Label>
                          <input type="color" value={selectedElement.gradient?.colors?.[0] || "#3b82f6"} onChange={(e) => updateElement(selectedElement.id, { gradient: { ...selectedElement.gradient!, colors: [e.target.value, selectedElement.gradient?.colors?.[1] || "#8b5cf6"] } })} className="w-full h-8 mt-1 rounded border cursor-pointer" />
                        </div>
                        <div>
                          <Label className="text-xs">Color 2</Label>
                          <input type="color" value={selectedElement.gradient?.colors?.[1] || "#8b5cf6"} onChange={(e) => updateElement(selectedElement.id, { gradient: { ...selectedElement.gradient!, colors: [selectedElement.gradient?.colors?.[0] || "#3b82f6", e.target.value] } })} className="w-full h-8 mt-1 rounded border cursor-pointer" />
                        </div>
                      </div>
                      {selectedElement.gradient?.type === "linear" && (
                        <div>
                          <Label className="text-xs">Angle: {selectedElement.gradient?.angle || 135}°</Label>
                          <input type="range" min="0" max="360" value={selectedElement.gradient?.angle || 135} onChange={(e) => updateElement(selectedElement.id, { gradient: { ...selectedElement.gradient!, angle: parseInt(e.target.value) } })} className="w-full mt-1 h-2 bg-background rounded-lg appearance-none cursor-pointer" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Line Properties */}
            {selectedElement.type === "line" && (
              <>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Color</Label>
                  <div className="flex gap-2 mt-2">
                    <input type="color" value={selectedElement.color || "#000000"} onChange={(e) => updateElement(selectedElement.id, { color: e.target.value })} className="h-8 w-10 rounded border cursor-pointer" />
                    <Input value={selectedElement.color || "#000000"} onChange={(e) => updateElement(selectedElement.id, { color: e.target.value })} className="flex-1 h-8" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</Label>
                  <Select value={selectedElement.lineStyle || "solid"} onValueChange={(v: "solid" | "dashed" | "dotted") => updateElement(selectedElement.id, { lineStyle: v })}>
                    <SelectTrigger className="mt-2 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solid">Solid</SelectItem>
                      <SelectItem value="dashed">Dashed</SelectItem>
                      <SelectItem value="dotted">Dotted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Image Properties */}
            {selectedElement.type === "image" && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Image</Label>
                <div className="mt-2 space-y-2">
                  <Button variant="outline" size="sm" className="w-full" onClick={() => elementImageInputRef.current?.click()}><Upload className="h-4 w-4 mr-2" />Upload</Button>
                  {event?.logo_url && <Button variant="outline" size="sm" className="w-full" onClick={() => updateElement(selectedElement.id, { imageUrl: event.logo_url || "" })}>Use Event Logo</Button>}
                </div>
              </div>
            )}

            {/* Opacity */}
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Opacity</Label>
                <span className="text-xs text-muted-foreground">{selectedElement.opacity ?? 100}%</span>
              </div>
              <input type="range" min="0" max="100" value={selectedElement.opacity ?? 100} onChange={(e) => updateElement(selectedElement.id, { opacity: parseInt(e.target.value) })} className="w-full mt-2 h-2 bg-muted rounded-lg appearance-none cursor-pointer" />
            </div>

            {/* Border */}
            {(selectedElement.type === "text" || selectedElement.type === "shape") && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Border</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div><Label className="text-xs">Width</Label><Input type="number" min="0" value={selectedElement.borderWidth || 0} onChange={(e) => updateElement(selectedElement.id, { borderWidth: parseInt(e.target.value) || 0 })} className="mt-1 h-8" /></div>
                  <div><Label className="text-xs">Radius</Label><Input type="number" min="0" value={selectedElement.borderRadius || 0} onChange={(e) => updateElement(selectedElement.id, { borderRadius: parseInt(e.target.value) || 0 })} className="mt-1 h-8" /></div>
                </div>
                {(selectedElement.borderWidth || 0) > 0 && (
                  <div className="flex gap-2 mt-2">
                    <input type="color" value={selectedElement.borderColor || "#000000"} onChange={(e) => updateElement(selectedElement.id, { borderColor: e.target.value })} className="h-8 w-10 rounded border cursor-pointer" />
                    <Input value={selectedElement.borderColor || "#000000"} onChange={(e) => updateElement(selectedElement.id, { borderColor: e.target.value })} className="flex-1 h-8" />
                  </div>
                )}
              </div>
            )}

            {/* Shadow */}
            {(selectedElement.type === "text" || selectedElement.type === "shape" || selectedElement.type === "image") && (
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Shadow</Label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={selectedElement.shadowEnabled || false} onChange={(e) => updateElement(selectedElement.id, { shadowEnabled: e.target.checked })} className="rounded border-gray-300" />
                  </label>
                </div>
                {selectedElement.shadowEnabled && (
                  <div className="mt-2 space-y-2 p-2 bg-muted/50 rounded-lg">
                    <div className="flex gap-2">
                      <input type="color" value={selectedElement.shadowColor || "#000000"} onChange={(e) => updateElement(selectedElement.id, { shadowColor: e.target.value })} className="h-8 w-10 rounded border cursor-pointer" />
                      <Input value={selectedElement.shadowColor || "#000000"} onChange={(e) => updateElement(selectedElement.id, { shadowColor: e.target.value })} className="flex-1 h-8" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label className="text-xs">Blur</Label><Input type="number" min="0" value={selectedElement.shadowBlur || 4} onChange={(e) => updateElement(selectedElement.id, { shadowBlur: parseInt(e.target.value) || 0 })} className="mt-1 h-8" /></div>
                      <div><Label className="text-xs">X</Label><Input type="number" value={selectedElement.shadowOffsetX || 2} onChange={(e) => updateElement(selectedElement.id, { shadowOffsetX: parseInt(e.target.value) || 0 })} className="mt-1 h-8" /></div>
                      <div><Label className="text-xs">Y</Label><Input type="number" value={selectedElement.shadowOffsetY || 2} onChange={(e) => updateElement(selectedElement.id, { shadowOffsetY: parseInt(e.target.value) || 0 })} className="mt-1 h-8" /></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Layer Controls */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Layer</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={bringToFront} className="h-8"><ArrowUpToLine className="h-4 w-4 mr-1" />Front</Button>
                <Button variant="outline" size="sm" onClick={sendToBack} className="h-8"><ArrowDownToLine className="h-4 w-4 mr-1" />Back</Button>
              </div>
            </div>

            {/* Lock */}
            <Button variant={selectedElement.locked ? "secondary" : "outline"} size="sm" className="w-full h-8" onClick={() => updateElement(selectedElement.id, { locked: !selectedElement.locked })}>
              {selectedElement.locked ? <><Lock className="h-4 w-4 mr-2" />Locked</> : <><Unlock className="h-4 w-4 mr-2" />Unlocked</>}
            </Button>

            {/* Actions */}
            <div className="pt-4 border-t grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="h-8" onClick={() => duplicateElement(selectedElement.id)}><Copy className="h-4 w-4 mr-1" />Duplicate</Button>
              <Button variant="outline" size="sm" className="h-8 text-destructive hover:text-destructive" onClick={() => deleteElement(selectedElement.id)}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
            </div>
          </div>
        ) : selectedElementIds.length === 0 && (
          <div className="flex-1 p-4 space-y-4">
            {/* Empty state */}
            <div className="text-center py-6 text-muted-foreground">
              <MousePointer className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="font-medium text-foreground">No element selected</p>
              <p className="text-xs mt-1">Click on an element to edit its properties</p>
            </div>

            {/* Quick Tips */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Tips</h4>

              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs font-medium mb-1">Multi-select</p>
                  <p className="text-xs text-muted-foreground">Hold <kbd className="px-1 py-0.5 rounded bg-background border text-[10px]">Shift</kbd> or <kbd className="px-1 py-0.5 rounded bg-background border text-[10px]">Ctrl</kbd> and click to select multiple elements</p>
                </div>

                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs font-medium mb-1">Quick actions</p>
                  <p className="text-xs text-muted-foreground">Right-click on any element for quick actions like duplicate, lock, or delete</p>
                </div>

                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs font-medium mb-1">Precise positioning</p>
                  <p className="text-xs text-muted-foreground">Use <kbd className="px-1 py-0.5 rounded bg-background border text-[10px]">Arrow</kbd> keys to move elements. Hold <kbd className="px-1 py-0.5 rounded bg-background border text-[10px]">Shift</kbd> for 10px steps</p>
                </div>
              </div>
            </div>

            {/* Template Info */}
            <div className="pt-3 border-t space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Template Info</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Size:</span>
                  <span className="ml-1 font-medium">{BADGE_SIZES[template.size].label}</span>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Elements:</span>
                  <span className="ml-1 font-medium">{template.elements.length}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Keyboard Shortcuts */}
        <div className="p-3 border-t bg-muted/30">
          <details className="text-xs">
            <summary className="font-medium cursor-pointer text-muted-foreground hover:text-foreground">Keyboard Shortcuts</summary>
            <div className="mt-2 space-y-1 text-muted-foreground">
              <p><kbd className="bg-muted px-1 rounded">Ctrl+Z</kbd> Undo</p>
              <p><kbd className="bg-muted px-1 rounded">Ctrl+C/V</kbd> Copy/Paste</p>
              <p><kbd className="bg-muted px-1 rounded">Del</kbd> Delete</p>
              <p><kbd className="bg-muted px-1 rounded">Arrows</kbd> Move</p>
            </div>
          </details>
        </div>
      </div>

      {/* Templates Dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Badge Templates</DialogTitle>
          </DialogHeader>
          <div className="py-4 max-h-96 overflow-auto">
            {isLoadingTemplates ? (
              <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
            ) : savedTemplates?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No templates yet</p>
                <p className="text-sm">Design a badge and save it</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {savedTemplates?.map((t: any) => (
                  <div key={t.id} className={cn("p-4 rounded-lg border cursor-pointer hover:bg-accent transition-colors", savedTemplateId === t.id && "ring-2 ring-primary")} onClick={() => loadTemplate(t)}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{t.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{t.ticket_type_ids?.length ? `${t.ticket_type_ids.length} ticket types` : "All tickets"}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); deleteTemplateById(t.id) }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>Close</Button>
            <Button onClick={() => { setTemplate({ id: "", name: "New Badge Template", size: "4x3", backgroundColor: "#ffffff", backgroundImageUrl: null, elements: [] }); setSavedTemplateId(null); setHasUnsavedChanges(true); setSelectedTicketTypes([]); setIsTemplateDialogOpen(false) }}><Plus className="h-4 w-4 mr-2" />New</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Dialog */}
      <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export Badges</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Filter by Ticket Type</Label>
              <Select value={printFilter} onValueChange={setPrintFilter}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {selectedTicketTypes.length > 0
                      ? `Assigned types (${registrations?.filter((r: any) => selectedTicketTypes.includes(r.ticket_type_id)).length || 0})`
                      : `All (${registrations?.length || 0})`}
                  </SelectItem>
                  {ticketTypes?.map((t: any) => {
                    const count = registrations?.filter((r: any) => r.ticket_type_id === t.id).length || 0
                    return <SelectItem key={t.id} value={t.id}>{t.name} ({count})</SelectItem>
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Badges per A4 Page</Label>
                <Select value={badgesPerPage.toString()} onValueChange={(v) => setBadgesPerPage(parseInt(v))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 badge per page (original size)</SelectItem>
                    <SelectItem value="2">2 badges per page</SelectItem>
                    <SelectItem value="4">4 badges per page</SelectItem>
                    <SelectItem value="6">6 badges per page</SelectItem>
                    <SelectItem value="8">8 badges per page</SelectItem>
                  </SelectContent>
                </Select>
                {badgesPerPage > 1 && (
                  <p className="text-xs text-muted-foreground mt-1">Badges will be arranged on A4 paper</p>
                )}
              </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm"><strong>{printFilter === "all"
                ? (selectedTicketTypes.length > 0
                    ? registrations?.filter((r: any) => selectedTicketTypes.includes(r.ticket_type_id)).length || 0
                    : registrations?.length || 0)
                : registrations?.filter((r: any) => r.ticket_type_id === printFilter).length || 0}</strong> badges will be generated</p>
              {!savedTemplateId && <p className="text-sm text-amber-600 mt-2">Save the template first</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPrintDialogOpen(false)}>Cancel</Button>
            <Button onClick={generatePdf} disabled={!savedTemplateId || isGeneratingPdf}>
              {isGeneratingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pre-built Templates Dialog */}
      <Dialog open={isPreBuiltDialogOpen} onOpenChange={setIsPreBuiltDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Pre-built Templates
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">Choose a template to get started quickly. This will replace your current design.</p>
            <div className="grid grid-cols-2 gap-4">
              {PRE_BUILT_TEMPLATES.map((t, idx) => (
                <button
                  key={idx}
                  onClick={() => applyPreBuiltTemplate(t)}
                  className="p-4 rounded-lg border bg-background hover:bg-accent hover:border-primary/50 transition-all text-left group"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-md bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <FileImage className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t.elements.length} elements</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreBuiltDialogOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Context Menu */}
      {contextMenu && (() => {
        const contextElement = template.elements.find((el) => el.id === contextMenu.elementId)
        if (!contextElement) return null
        return (
          <div className="fixed z-[100] bg-popover rounded-lg shadow-lg border py-1 min-w-[160px]" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
            <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2" onClick={() => { duplicateElement(contextMenu.elementId); setContextMenu(null) }}><Copy className="h-4 w-4" />Duplicate</button>
            <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2" onClick={() => { copyElements(); setContextMenu(null) }}><Clipboard className="h-4 w-4" />Copy</button>
            <div className="h-px bg-border my-1" />
            <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2" onClick={() => { bringToFront(); setContextMenu(null) }}><ArrowUpToLine className="h-4 w-4" />Bring to Front</button>
            <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2" onClick={() => { sendToBack(); setContextMenu(null) }}><ArrowDownToLine className="h-4 w-4" />Send to Back</button>
            <div className="h-px bg-border my-1" />
            <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2" onClick={() => { updateElement(contextMenu.elementId, { locked: !contextElement.locked }); setContextMenu(null) }}>
              {contextElement.locked ? <><Unlock className="h-4 w-4" />Unlock</> : <><Lock className="h-4 w-4" />Lock</>}
            </button>
            <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2" onClick={() => { toggleVisibility(contextMenu.elementId); setContextMenu(null) }}>
              {contextElement.visible === false ? <><Eye className="h-4 w-4" />Show</> : <><EyeOff className="h-4 w-4" />Hide</>}
            </button>
            <div className="h-px bg-border my-1" />
            <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-destructive/10 text-destructive flex items-center gap-2" onClick={() => { deleteElement(contextMenu.elementId); setContextMenu(null) }}><Trash2 className="h-4 w-4" />Delete</button>
          </div>
        )
      })()}
    </div>
  )
}

function QRCodePreview({ value, size }: { value: string; size: number }) {
  const [qrUrl, setQrUrl] = useState("")
  useEffect(() => {
    QRCode.toDataURL(value || "PREVIEW", { width: size * 2, margin: 1, errorCorrectionLevel: "M" }).then(setQrUrl).catch(() => {})
  }, [value, size])
  if (!qrUrl) return <div className="w-full h-full bg-muted flex items-center justify-center rounded"><QrCode className="h-6 w-6 text-muted-foreground" /></div>
  return <img src={qrUrl} alt="QR" className="w-full h-full object-contain" />
}

function BarcodePreview({ value, format, width, height }: { value: string; format: string; width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (canvasRef.current && value) {
      try {
        JsBarcode(canvasRef.current, value, {
          format: format as any,
          width: 2,
          height: Math.max(30, height - 20),
          displayValue: true,
          fontSize: 12,
          margin: 5,
        })
      } catch (e) {
        // Invalid barcode value
      }
    }
  }, [value, format, height])
  return (
    <div className="w-full h-full flex items-center justify-center bg-white">
      <canvas ref={canvasRef} style={{ maxWidth: "100%", maxHeight: "100%" }} />
    </div>
  )
}
