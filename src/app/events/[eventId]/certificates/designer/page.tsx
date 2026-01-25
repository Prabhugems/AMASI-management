"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
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
} from "lucide-react"
import JsBarcode from "jsbarcode"
import { cn } from "@/lib/utils"
import QRCode from "qrcode"

// Certificate sizes (larger than badges)
const CERTIFICATE_SIZES: Record<string, { width: number; height: number; label: string }> = {
  "A4-landscape": { width: 1123, height: 794, label: "A4 Landscape" },
  "A4-portrait": { width: 794, height: 1123, label: "A4 Portrait" },
  "Letter-landscape": { width: 1056, height: 816, label: "Letter Landscape" },
  "Letter-portrait": { width: 816, height: 1056, label: "Letter Portrait" },
  "A3-landscape": { width: 1587, height: 1123, label: "A3 Landscape" },
  "A3-portrait": { width: 1123, height: 1587, label: "A3 Portrait" },
}

// Predefined fields for certificates
const PREDEFINED_FIELDS: { key: string; label: string; icon: any; placeholder: string; defaultSize: { w: number; h: number }; fontSize: number; fontWeight: "normal" | "bold" }[] = [
  { key: "name", label: "Recipient Name", icon: User, placeholder: "{{name}}", defaultSize: { w: 600, h: 60 }, fontSize: 36, fontWeight: "bold" },
  { key: "event_name", label: "Event Name", icon: MapPin, placeholder: "{{event_name}}", defaultSize: { w: 700, h: 50 }, fontSize: 28, fontWeight: "bold" },
  { key: "institution", label: "Institution", icon: Building2, placeholder: "{{institution}}", defaultSize: { w: 500, h: 35 }, fontSize: 20, fontWeight: "normal" },
  { key: "designation", label: "Designation", icon: Briefcase, placeholder: "{{designation}}", defaultSize: { w: 400, h: 30 }, fontSize: 18, fontWeight: "normal" },
  { key: "ticket_type", label: "Participation Type", icon: Ticket, placeholder: "{{ticket_type}}", defaultSize: { w: 350, h: 30 }, fontSize: 18, fontWeight: "normal" },
  { key: "event_date", label: "Event Date", icon: Calendar, placeholder: "{{event_date}}", defaultSize: { w: 350, h: 30 }, fontSize: 18, fontWeight: "normal" },
  { key: "issue_date", label: "Issue Date", icon: Calendar, placeholder: "{{issue_date}}", defaultSize: { w: 300, h: 28 }, fontSize: 16, fontWeight: "normal" },
  { key: "registration_number", label: "Certificate No.", icon: Hash, placeholder: "{{registration_number}}", defaultSize: { w: 250, h: 25 }, fontSize: 14, fontWeight: "normal" },
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

// Pre-built certificate templates (A4 landscape: 1123x794)
const PRE_BUILT_TEMPLATES: { name: string; description: string; elements: Omit<CertificateElement, "id">[] }[] = [
  {
    name: "Classic Certificate",
    description: "Traditional formal design",
    elements: [
      { type: "shape", x: 30, y: 30, width: 1063, height: 734, backgroundColor: "#ffffff", borderWidth: 3, borderColor: "#1e40af", shapeType: "rectangle", zIndex: 0 },
      { type: "shape", x: 45, y: 45, width: 1033, height: 704, backgroundColor: "transparent", borderWidth: 1, borderColor: "#93c5fd", shapeType: "rectangle", zIndex: 0 },
      { type: "text", x: 100, y: 80, width: 923, height: 50, content: "CERTIFICATE OF PARTICIPATION", fontSize: 32, fontWeight: "bold", color: "#1e40af", align: "center", zIndex: 1 },
      { type: "line", x: 400, y: 140, width: 323, height: 2, color: "#1e40af", zIndex: 1 },
      { type: "text", x: 100, y: 170, width: 923, height: 35, content: "This is to certify that", fontSize: 18, color: "#6b7280", align: "center", zIndex: 1 },
      { type: "text", x: 100, y: 220, width: 923, height: 70, content: "{{name}}", fontSize: 42, fontWeight: "bold", color: "#111827", align: "center", zIndex: 1 },
      { type: "text", x: 100, y: 310, width: 923, height: 35, content: "from {{institution}}", fontSize: 18, color: "#6b7280", align: "center", zIndex: 1 },
      { type: "text", x: 100, y: 360, width: 923, height: 35, content: "has successfully participated in", fontSize: 18, color: "#6b7280", align: "center", zIndex: 1 },
      { type: "text", x: 100, y: 410, width: 923, height: 50, content: "{{event_name}}", fontSize: 28, fontWeight: "bold", color: "#1e40af", align: "center", zIndex: 1 },
      { type: "text", x: 100, y: 480, width: 923, height: 30, content: "held on {{event_date}}", fontSize: 16, color: "#6b7280", align: "center", zIndex: 1 },
      { type: "line", x: 150, y: 620, width: 250, height: 1, color: "#374151", zIndex: 1 },
      { type: "text", x: 150, y: 630, width: 250, height: 25, content: "Signature", fontSize: 14, color: "#6b7280", align: "center", zIndex: 1 },
      { type: "line", x: 723, y: 620, width: 250, height: 1, color: "#374151", zIndex: 1 },
      { type: "text", x: 723, y: 630, width: 250, height: 25, content: "Date: {{issue_date}}", fontSize: 14, color: "#6b7280", align: "center", zIndex: 1 },
      { type: "qr_code", x: 500, y: 580, width: 80, height: 80, content: "{{registration_number}}", zIndex: 1 },
      { type: "text", x: 480, y: 665, width: 120, height: 20, content: "{{registration_number}}", fontSize: 10, color: "#9ca3af", align: "center", zIndex: 1 },
    ]
  },
  {
    name: "Modern Gradient",
    description: "Contemporary colorful design",
    elements: [
      { type: "shape", x: 0, y: 0, width: 1123, height: 120, backgroundColor: "#7c3aed", gradient: { enabled: true, type: "linear", colors: ["#7c3aed", "#db2777"], angle: 135 }, shapeType: "rectangle", zIndex: 0 },
      { type: "text", x: 100, y: 40, width: 923, height: 50, content: "CERTIFICATE OF ACHIEVEMENT", fontSize: 30, fontWeight: "bold", color: "#ffffff", align: "center", zIndex: 1 },
      { type: "text", x: 100, y: 160, width: 923, height: 35, content: "This certificate is proudly presented to", fontSize: 18, color: "#6b7280", align: "center", zIndex: 1 },
      { type: "text", x: 100, y: 210, width: 923, height: 70, content: "{{name}}", fontSize: 44, fontWeight: "bold", color: "#7c3aed", align: "center", zIndex: 1 },
      { type: "line", x: 350, y: 290, width: 423, height: 3, color: "#db2777", zIndex: 1 },
      { type: "text", x: 100, y: 320, width: 923, height: 35, content: "{{designation}} at {{institution}}", fontSize: 18, color: "#374151", align: "center", zIndex: 1 },
      { type: "text", x: 100, y: 380, width: 923, height: 35, content: "for outstanding participation in", fontSize: 18, color: "#6b7280", align: "center", zIndex: 1 },
      { type: "text", x: 100, y: 430, width: 923, height: 50, content: "{{event_name}}", fontSize: 26, fontWeight: "bold", color: "#111827", align: "center", zIndex: 1 },
      { type: "text", x: 100, y: 500, width: 923, height: 30, content: "{{event_date}}", fontSize: 16, color: "#6b7280", align: "center", zIndex: 1 },
      { type: "shape", x: 0, y: 674, width: 1123, height: 120, backgroundColor: "#7c3aed", gradient: { enabled: true, type: "linear", colors: ["#db2777", "#7c3aed"], angle: 135 }, shapeType: "rectangle", zIndex: 0 },
      { type: "qr_code", x: 520, y: 580, width: 70, height: 70, content: "{{registration_number}}", zIndex: 1 },
      { type: "text", x: 100, y: 710, width: 450, height: 30, content: "Certificate No: {{registration_number}}", fontSize: 14, color: "#ffffff", align: "left", zIndex: 1 },
      { type: "text", x: 573, y: 710, width: 450, height: 30, content: "Issued: {{issue_date}}", fontSize: 14, color: "#ffffff", align: "right", zIndex: 1 },
    ]
  },
  {
    name: "Elegant Minimal",
    description: "Clean and sophisticated",
    elements: [
      { type: "line", x: 100, y: 80, width: 923, height: 2, color: "#d1d5db", zIndex: 1 },
      { type: "text", x: 100, y: 100, width: 923, height: 40, content: "Certificate of Participation", fontSize: 28, fontWeight: "bold", color: "#111827", align: "center", zIndex: 1 },
      { type: "line", x: 100, y: 150, width: 923, height: 2, color: "#d1d5db", zIndex: 1 },
      { type: "text", x: 100, y: 200, width: 923, height: 30, content: "This is to certify that", fontSize: 16, color: "#9ca3af", align: "center", zIndex: 1 },
      { type: "text", x: 100, y: 260, width: 923, height: 70, content: "{{name}}", fontSize: 48, fontWeight: "bold", color: "#111827", align: "center", zIndex: 1 },
      { type: "line", x: 400, y: 340, width: 323, height: 1, color: "#111827", zIndex: 1 },
      { type: "text", x: 100, y: 370, width: 923, height: 30, content: "{{institution}}", fontSize: 18, color: "#6b7280", align: "center", zIndex: 1 },
      { type: "text", x: 100, y: 430, width: 923, height: 30, content: "has participated in", fontSize: 16, color: "#9ca3af", align: "center", zIndex: 1 },
      { type: "text", x: 100, y: 480, width: 923, height: 45, content: "{{event_name}}", fontSize: 24, fontWeight: "bold", color: "#111827", align: "center", zIndex: 1 },
      { type: "text", x: 100, y: 550, width: 923, height: 25, content: "{{event_date}}", fontSize: 14, color: "#9ca3af", align: "center", zIndex: 1 },
      { type: "qr_code", x: 520, y: 620, width: 60, height: 60, content: "{{registration_number}}", zIndex: 1 },
      { type: "text", x: 100, y: 700, width: 450, height: 20, content: "{{registration_number}}", fontSize: 12, color: "#d1d5db", align: "left", zIndex: 1 },
      { type: "text", x: 573, y: 700, width: 450, height: 20, content: "{{issue_date}}", fontSize: 12, color: "#d1d5db", align: "right", zIndex: 1 },
    ]
  },
  {
    name: "Conference Certificate",
    description: "Professional conference style",
    elements: [
      { type: "shape", x: 0, y: 0, width: 1123, height: 80, backgroundColor: "#059669", shapeType: "rectangle", zIndex: 0 },
      { type: "text", x: 50, y: 25, width: 1023, height: 35, content: "{{event_name}}", fontSize: 22, fontWeight: "bold", color: "#ffffff", align: "center", zIndex: 1 },
      { type: "text", x: 100, y: 120, width: 923, height: 45, content: "CERTIFICATE OF ATTENDANCE", fontSize: 28, fontWeight: "bold", color: "#059669", align: "center", zIndex: 1 },
      { type: "text", x: 100, y: 190, width: 923, height: 30, content: "This certifies that", fontSize: 16, color: "#6b7280", align: "center", zIndex: 1 },
      { type: "text", x: 100, y: 240, width: 923, height: 65, content: "{{name}}", fontSize: 40, fontWeight: "bold", color: "#111827", align: "center", zIndex: 1 },
      { type: "shape", x: 400, y: 315, width: 323, height: 35, backgroundColor: "#d1fae5", borderRadius: 17, shapeType: "rounded", zIndex: 0 },
      { type: "text", x: 400, y: 322, width: 323, height: 25, content: "{{ticket_type}}", fontSize: 14, fontWeight: "bold", color: "#059669", align: "center", zIndex: 1 },
      { type: "text", x: 100, y: 370, width: 923, height: 30, content: "{{designation}}, {{institution}}", fontSize: 16, color: "#374151", align: "center", zIndex: 1 },
      { type: "text", x: 100, y: 430, width: 923, height: 30, content: "attended the conference held on", fontSize: 16, color: "#6b7280", align: "center", zIndex: 1 },
      { type: "text", x: 100, y: 470, width: 923, height: 30, content: "{{event_date}}", fontSize: 18, fontWeight: "bold", color: "#059669", align: "center", zIndex: 1 },
      { type: "line", x: 150, y: 600, width: 250, height: 1, color: "#374151", zIndex: 1 },
      { type: "text", x: 150, y: 610, width: 250, height: 25, content: "Organizer Signature", fontSize: 12, color: "#6b7280", align: "center", zIndex: 1 },
      { type: "qr_code", x: 500, y: 560, width: 80, height: 80, content: "{{registration_number}}", zIndex: 1 },
      { type: "line", x: 723, y: 600, width: 250, height: 1, color: "#374151", zIndex: 1 },
      { type: "text", x: 723, y: 610, width: 250, height: 25, content: "Director Signature", fontSize: 12, color: "#6b7280", align: "center", zIndex: 1 },
      { type: "shape", x: 0, y: 714, width: 1123, height: 80, backgroundColor: "#059669", shapeType: "rectangle", zIndex: 0 },
      { type: "text", x: 50, y: 740, width: 500, height: 20, content: "Certificate No: {{registration_number}}", fontSize: 12, color: "#ffffff", align: "left", zIndex: 1 },
      { type: "text", x: 573, y: 740, width: 500, height: 20, content: "Issue Date: {{issue_date}}", fontSize: 12, color: "#ffffff", align: "right", zIndex: 1 },
    ]
  }
]

interface CertificateElement {
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

interface CertificateTemplate {
  id: string
  name: string
  size: keyof typeof CERTIFICATE_SIZES
  backgroundColor: string
  backgroundImageUrl: string | null
  elements: CertificateElement[]
}

export default function CertificateDesignerPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const elementImageInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

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
  const [template, setTemplate] = useState<CertificateTemplate>({
    id: "",
    name: "New Certificate Template",
    size: "A4-landscape",
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
  const [exportFormat, setExportFormat] = useState<"pdf" | "png" | "jpg">("pdf")
  const [certificatesPerPage, setCertificatesPerPage] = useState(1)

  // History
  const [history, setHistory] = useState<CertificateTemplate[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [clipboard, setClipboard] = useState<CertificateElement[]>([])
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; elementId: string } | null>(null)

  // History functions
  const saveToHistory = useCallback((newTemplate: CertificateTemplate) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1)
      return [...newHistory, JSON.parse(JSON.stringify(newTemplate))].slice(-50)
    })
    setHistoryIndex((prev) => Math.min(prev + 1, 49))
  }, [historyIndex])

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1)
      setTemplate(JSON.parse(JSON.stringify(history[historyIndex - 1])))
    }
  }, [history, historyIndex])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((prev) => prev + 1)
      setTemplate(JSON.parse(JSON.stringify(history[historyIndex + 1])))
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
    queryKey: ["event-certificate", eventId],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id, name, short_name, logo_url, start_date, end_date").eq("id", eventId).single()
      return data as { id: string; name: string; short_name: string; logo_url: string | null; start_date: string | null; end_date: string | null } | null
    },
  })

  const { data: ticketTypes } = useQuery({
    queryKey: ["ticket-types-certificate", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("ticket_types").select("id, name").eq("event_id", eventId)
      return data || []
    },
  })

  const { data: savedTemplates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["certificate-templates", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/certificate-templates?event_id=${eventId}`)
      if (!res.ok) return []
      return res.json()
    },
  })

  const { data: registrations } = useQuery({
    queryKey: ["registrations-certificate", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select(`id, registration_number, attendee_name, attendee_email, attendee_phone, attendee_institution, attendee_designation, ticket_type_id, ticket_types (name)`)
        .eq("event_id", eventId)
        .order("registration_number", { ascending: true })
        .limit(100)
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
  const certSize = CERTIFICATE_SIZES[template.size]

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
    if (event?.start_date && event?.end_date) {
      const start = new Date(event.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
      const end = new Date(event.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      result = result.replace(/\{\{event_date\}\}/g, `${start} - ${end}`)
    } else {
      result = result.replace(/\{\{event_date\}\}/g, "Event Date")
    }
    return result
  }, [event])

  const updateElement = useCallback((elementId: string, updates: Partial<CertificateElement>) => {
    setTemplate((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => el.id === elementId ? { ...el, ...updates } : el),
    }))
  }, [])

  // Quick alignment functions
  const centerHorizontally = useCallback(() => {
    selectedElementIds.forEach((id) => {
      const element = template.elements.find((el) => el.id === id)
      if (element && !element.locked) {
        updateElement(id, { x: Math.round((certSize.width - element.width) / 2) })
      }
    })
  }, [selectedElementIds, template.elements, certSize.width, updateElement])

  const centerVertically = useCallback(() => {
    selectedElementIds.forEach((id) => {
      const element = template.elements.find((el) => el.id === id)
      if (element && !element.locked) {
        updateElement(id, { y: Math.round((certSize.height - element.height) / 2) })
      }
    })
  }, [selectedElementIds, template.elements, certSize.height, updateElement])

  // Smart snap calculation - finds alignment guides with other elements
  const calculateSnapGuides = useCallback((draggedId: string, newX: number, newY: number, width: number, height: number) => {
    if (!snapEnabled) return { guides: { horizontal: [], vertical: [] }, snapX: newX, snapY: newY }

    const threshold = 5
    const horizontal: number[] = []
    const vertical: number[] = []
    let snapX = newX
    let snapY = newY

    // Canvas center and edges
    const canvasCenterX = certSize.width / 2
    const canvasCenterY = certSize.height / 2
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
    if (Math.abs(draggedRight - certSize.width) < threshold) { vertical.push(certSize.width); snapX = certSize.width - width }
    if (Math.abs(draggedBottom - certSize.height) < threshold) { horizontal.push(certSize.height); snapY = certSize.height - height }

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
  }, [snapEnabled, certSize, template.elements])

  const addPredefinedField = (field: typeof PREDEFINED_FIELDS[0]) => {
    const newElement: CertificateElement = {
      id: Date.now().toString(),
      type: "text",
      x: (certSize.width - field.defaultSize.w) / 2,
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
    const newElement: CertificateElement = {
      id: Date.now().toString(),
      type: "qr_code",
      x: (certSize.width - size) / 2,
      y: certSize.height - size - 20,
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
    const newElement: CertificateElement = {
      id: Date.now().toString(),
      type: "shape",
      x: shapeType === "circle" ? (certSize.width - 80) / 2 : 0,
      y: shapeType === "circle" ? 50 : 0,
      width: size || certSize.width,
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
    const newElement: CertificateElement = {
      id: Date.now().toString(),
      type: "barcode",
      x: (certSize.width - 180) / 2,
      y: certSize.height - 60,
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
    const newElement: CertificateElement = {
      id: Date.now().toString(),
      type: "photo",
      x: (certSize.width - size) / 2,
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
    const elements: CertificateElement[] = templateData.elements.map((el, idx) => ({
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
    const newElement: CertificateElement = {
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
    const newElement: CertificateElement = {
      id: Date.now().toString(),
      type: "line",
      x: 20,
      y: certSize.height / 2,
      width: certSize.width - 40,
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
    const newElement: CertificateElement = {
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
              const updates: Partial<CertificateElement> = {}
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
      const fileName = `certificate-templates/${eventId}/${Date.now()}.png`
      const { error } = await supabase.storage.from("event-assets").upload(fileName, pngFile, { contentType: "image/png" })
      if (error) throw error
      const { data: urlData } = supabase.storage.from("event-assets").getPublicUrl(fileName)
      setTemplate((prev) => ({ ...prev, backgroundImageUrl: urlData.publicUrl }))
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
      const fileName = `certificate-elements/${eventId}/${Date.now()}.png`
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
        ...(savedTemplateId && { id: savedTemplateId }),
      }
      const res = await fetch("/api/certificate-templates", {
        method: savedTemplateId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to save")
      const data = await res.json()
      setSavedTemplateId(data.id)
      queryClient.invalidateQueries({ queryKey: ["certificate-templates", eventId] })
      toast.success("Template saved!")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const loadTemplate = (t: any) => {
    const data = t.template_data || {}
    setTemplate({
      id: t.id,
      name: t.name,
      size: t.size || "4x3",
      backgroundColor: data.backgroundColor || "#ffffff",
      backgroundImageUrl: t.template_image_url,
      elements: data.elements || [],
    })
    setSavedTemplateId(t.id)
    setSelectedTicketTypes(t.ticket_type_ids || [])
    setIsTemplateDialogOpen(false)
    toast.success(`Loaded: ${t.name}`)
  }

  const deleteTemplateById = async (id: string) => {
    if (!confirm("Delete this template?")) return
    try {
      await fetch(`/api/certificate-templates?id=${id}`, { method: "DELETE" })
      queryClient.invalidateQueries({ queryKey: ["certificate-templates", eventId] })
      if (savedTemplateId === id) {
        setSavedTemplateId(null)
        setTemplate({ id: "", name: "New Certificate Template", size: "A4-landscape", backgroundColor: "#ffffff", backgroundImageUrl: null, elements: [] })
      }
      toast.success("Deleted")
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const generatePdf = async () => {
    if (!savedTemplateId) { toast.error("Please save the template first"); return }
    setIsGeneratingPdf(true)
    try {
      const filteredRegs = printFilter === "all" ? registrations : registrations?.filter((r: any) => r.ticket_type_id === printFilter)
      if (!filteredRegs?.length) { toast.error("No registrations to generate"); return }

      const res = await fetch("/api/certificates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          template_id: savedTemplateId,
          registration_ids: filteredRegs.map((r: any) => r.id),
          export_format: exportFormat,
          certificates_per_page: exportFormat === "pdf" ? certificatesPerPage : 1,
        }),
      })
      if (!res.ok) throw new Error("Failed to generate")
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const ext = exportFormat === "pdf" ? "pdf" : "zip"
      a.download = `certificates-${event?.short_name || "event"}.${ext}`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success(`Generated ${filteredRegs.length} certificates!`)
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

  const renderElement = (element: CertificateElement) => {
    const isSelected = selectedElementIds.includes(element.id)
    const rawContent = previewMode ? replacePlaceholders(element.content || "", currentRegistration) : element.content || ""
    const content = element.type === "text" ? applyTextCase(rawContent, element.textCase) : rawContent
    const rotation = element.rotation || 0

    // Get gradient background style
    const getGradientStyle = (el: CertificateElement): string | undefined => {
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
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading Certificate Designer...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-muted/30">
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
                    <strong>Tip:</strong> Use <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900">{"{{name}}"}</code> placeholders for dynamic content that changes per certificate.
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
                  onChange={(e) => setTemplate((p) => ({ ...p, name: e.target.value }))}
                  className="mt-2"
                  placeholder="Enter template name"
                />
              </div>

              {/* Certificate Size */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Certificate Size</Label>
                <Select value={template.size} onValueChange={(v: keyof typeof CERTIFICATE_SIZES) => setTemplate((p) => ({ ...p, size: v }))}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CERTIFICATE_SIZES).map(([key, val]) => (
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
                        onChange={(e) => setTemplate((p) => ({ ...p, backgroundColor: e.target.value }))}
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
                        onClick={() => setTemplate((p) => ({ ...p, backgroundImageUrl: null }))}
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
            <Button variant="outline" size="sm" onClick={saveTemplate} disabled={isSaving} className="gap-2">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
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
                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 bg-muted/50 border-b flex items-end overflow-hidden" style={{ width: certSize.width * zoom + 40 }}>
                  <div className="flex-1 relative h-4" style={{ marginLeft: 20, marginRight: 20 }}>
                    {Array.from({ length: Math.ceil(certSize.width / 50) + 1 }, (_, i) => (
                      <div key={i} className="absolute bottom-0 flex flex-col items-center" style={{ left: i * 50 * zoom }}>
                        <span className="text-[8px] text-muted-foreground mb-0.5">{i * 50}</span>
                        <div className="w-px h-2 bg-muted-foreground/50" />
                      </div>
                    ))}
                  </div>
                </div>
                {/* Left Ruler */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-6 bg-muted/50 border-r flex items-center overflow-hidden" style={{ height: certSize.height * zoom + 40 }}>
                  <div className="flex-1 relative w-4 h-full" style={{ marginTop: 20, marginBottom: 20 }}>
                    {Array.from({ length: Math.ceil(certSize.height / 50) + 1 }, (_, i) => (
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
                width: certSize.width * zoom,
                height: certSize.height * zoom,
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
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground pointer-events-none">
                  <div className="text-center">
                    <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Start designing</p>
                    <p className="text-sm text-muted-foreground">Add elements from the left panel</p>
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
                  <span className="ml-1 font-medium">{CERTIFICATE_SIZES[template.size].label}</span>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Certificate Templates</DialogTitle>
          </DialogHeader>
          <div className="py-4 max-h-96 overflow-auto">
            {isLoadingTemplates ? (
              <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
            ) : savedTemplates?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No templates yet</p>
                <p className="text-sm">Design a certificate and save it</p>
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
            <Button onClick={() => { setTemplate({ id: "", name: "New Certificate Template", size: "A4-landscape", backgroundColor: "#ffffff", backgroundImageUrl: null, elements: [] }); setSavedTemplateId(null); setSelectedTicketTypes([]); setIsTemplateDialogOpen(false) }}><Plus className="h-4 w-4 mr-2" />New</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Dialog */}
      <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export Certificates</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Filter by Ticket Type</Label>
              <Select value={printFilter} onValueChange={setPrintFilter}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ({registrations?.length || 0})</SelectItem>
                  {ticketTypes?.map((t: any) => {
                    const count = registrations?.filter((r: any) => r.ticket_type_id === t.id).length || 0
                    return <SelectItem key={t.id} value={t.id}>{t.name} ({count})</SelectItem>
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Export Format</Label>
              <Select value={exportFormat} onValueChange={(v: "pdf" | "png" | "jpg") => setExportFormat(v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="png">PNG Images (ZIP)</SelectItem>
                  <SelectItem value="jpg">JPG Images (ZIP)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {exportFormat === "pdf" && (
              <div>
                <Label>Certificates per Page</Label>
                <Select value={certificatesPerPage.toString()} onValueChange={(v) => setCertificatesPerPage(parseInt(v))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 certificate per page (full size)</SelectItem>
                    <SelectItem value="2">2 certificates per page</SelectItem>
                    <SelectItem value="4">4 certificates per page</SelectItem>
                    <SelectItem value="6">6 certificates per page</SelectItem>
                    <SelectItem value="8">8 certificates per page</SelectItem>
                  </SelectContent>
                </Select>
                {certificatesPerPage > 1 && (
                  <p className="text-xs text-muted-foreground mt-1">Certificates will be arranged on paper</p>
                )}
              </div>
            )}

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm"><strong>{printFilter === "all" ? registrations?.length || 0 : registrations?.filter((r: any) => r.ticket_type_id === printFilter).length || 0}</strong> certificates will be generated</p>
              {!savedTemplateId && <p className="text-sm text-amber-600 mt-2">Save the template first</p>}
              {exportFormat !== "pdf" && <p className="text-xs text-muted-foreground mt-2">Images will be downloaded as a ZIP file</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPrintDialogOpen(false)}>Cancel</Button>
            <Button onClick={generatePdf} disabled={!savedTemplateId || isGeneratingPdf}>
              {isGeneratingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Download {exportFormat.toUpperCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pre-built Templates Dialog */}
      <Dialog open={isPreBuiltDialogOpen} onOpenChange={setIsPreBuiltDialogOpen}>
        <DialogContent className="max-w-2xl">
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
