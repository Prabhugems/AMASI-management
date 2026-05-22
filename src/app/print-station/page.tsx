"use client"

import { useEffect, useState } from "react"
import {
  Download,
  Monitor,
  Apple,
  CheckCircle,
  Printer,
  ScanLine,
  Settings,
  HelpCircle,
  AlertTriangle,
} from "lucide-react"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { COMPANY_CONFIG } from "@/lib/config"

export default function PrintStationDownloadPage() {
  const [serverUrl, setServerUrl] = useState("https://your-domain.com")
  useEffect(() => {
    setServerUrl(window.location.origin)
  }, [])

  const steps = [
    {
      icon: Download,
      title: "Download & install",
      description: "Download the app for your operating system and install it.",
    },
    {
      icon: Settings,
      title: "Configure settings",
      description: "Enter your server URL and printer IP address in the Settings tab.",
    },
    {
      icon: ScanLine,
      title: "Scan QR codes",
      description: "Use a USB barcode scanner or type registration codes directly.",
    },
    {
      icon: Printer,
      title: "Print badges",
      description: "Click Print Badge to send directly to your Zebra printer.",
    },
  ]

  const faqs = [
    {
      question: "What printer do I need?",
      answer:
        "You need a Zebra thermal printer (ZD230, ZD420, or similar) connected to your network. The printer must have a network IP address (e.g., 10.0.1.12).",
    },
    {
      question: "How do I find my printer's IP address?",
      answer:
        "Print a configuration label from your Zebra printer (hold the feed button for 2 seconds). The IP address will be listed under 'Network Configuration'. Or ask your IT team.",
    },
    {
      question: "What is the Server URL?",
      answer: `This is your ${COMPANY_CONFIG.name} event management website URL (e.g., ${serverUrl}). This is where the app fetches registration data from.`,
    },
    {
      question: "Can I use a USB barcode scanner?",
      answer:
        "Yes. USB barcode scanners work like keyboards — just scan the QR code and it will automatically type the code into the app.",
    },
    {
      question: "The printer is not connecting?",
      answer:
        "1. Make sure your laptop is on the same network as the printer. 2. Check the printer IP is correct. 3. Try pinging the printer from terminal/command prompt. 4. Contact IT if the issue persists.",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-gray-800/50 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Printer className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {COMPANY_CONFIG.name} Print Station
              </h1>
              <p className="text-sm text-gray-400">On-spot badge printing application</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-12">
        {/* IT Admin notice — action-panel pattern */}
        <div className="bg-gray-800/50 outline outline-1 -outline-offset-1 outline-white/10 rounded-lg p-5">
          <div className="sm:flex sm:items-start sm:gap-4">
            <div className="size-10 flex-none rounded-full bg-amber-500/15 outline outline-1 -outline-offset-1 outline-amber-500/30 flex items-center justify-center text-amber-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="mt-3 sm:mt-0 flex-1">
              <h3 className="text-base font-semibold text-white">For IT Admin</h3>
              <p className="mt-1 text-sm text-gray-400">
                The installer file is located at{" "}
                <code className="bg-white/5 px-1.5 py-0.5 rounded text-xs text-gray-300">
                  print-station-app/dist/
                </code>
                . Upload to GitHub Releases or share via Google Drive with your staff.
              </p>
            </div>
          </div>
        </div>

        {/* Download cards — action-panel per OS */}
        <div>
          <h2 className="text-xl font-semibold text-white">
            Download for your operating system
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Version 1.0.0 · Requires macOS 10.15+ or Windows 10+
          </p>

          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            {/* Mac */}
            <div className="bg-gray-800/50 outline outline-1 -outline-offset-1 outline-white/10 rounded-lg p-5">
              <div className="flex items-start gap-4">
                <div className="size-12 flex-none rounded-xl bg-white/5 outline outline-1 -outline-offset-1 outline-white/10 flex items-center justify-center">
                  <Apple className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-white">Mac App</h3>
                  <p className="mt-0.5 text-xs text-gray-400 truncate">
                    {COMPANY_CONFIG.name} Print Station-1.0.0-arm64.dmg
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="size-1.5 rounded-full bg-emerald-400" />
                    <span className="text-xs font-medium text-emerald-300">
                      Built and ready
                    </span>
                  </div>
                </div>
              </div>
              <Button
                disabled
                className="w-full mt-5 bg-white/10 hover:bg-white/15 text-white disabled:opacity-60"
              >
                <Download className="h-4 w-4 mr-2" />
                Coming soon
              </Button>
            </div>

            {/* Windows */}
            <div className="bg-gray-800/50 outline outline-1 -outline-offset-1 outline-white/10 rounded-lg p-5">
              <div className="flex items-start gap-4">
                <div className="size-12 flex-none rounded-xl bg-white/5 outline outline-1 -outline-offset-1 outline-white/10 flex items-center justify-center">
                  <Monitor className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-white">Windows App</h3>
                  <p className="mt-0.5 text-xs text-gray-400">.exe installer</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="size-1.5 rounded-full bg-white/30" />
                    <span className="text-xs font-medium text-gray-400">
                      Run{" "}
                      <code className="bg-white/5 px-1 py-0.5 rounded">
                        npm run build:win
                      </code>
                    </span>
                  </div>
                </div>
              </div>
              <Button
                disabled
                className="w-full mt-5 bg-white/10 hover:bg-white/15 text-white disabled:opacity-60"
              >
                <Download className="h-4 w-4 mr-2" />
                Coming soon
              </Button>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-6">How it works</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((step, index) => (
              <div
                key={index}
                className="bg-gray-800/50 outline outline-1 -outline-offset-1 outline-white/10 rounded-lg p-5"
              >
                <div className="size-10 rounded-lg bg-indigo-500/15 outline outline-1 -outline-offset-1 outline-indigo-500/30 flex items-center justify-center text-indigo-300">
                  <step.icon className="w-5 h-5" />
                </div>
                <p className="mt-4 text-xs font-semibold text-indigo-300 uppercase tracking-wide">
                  Step {index + 1}
                </p>
                <h3 className="mt-1 text-sm font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-xs text-gray-400 leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Requirements */}
        <div className="bg-gray-800/50 outline outline-1 -outline-offset-1 outline-white/10 rounded-lg p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-white mb-6">Requirements</h2>
          <div className="grid sm:grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-300" />
                Printer
              </h3>
              <ul className="space-y-2">
                {[
                  "Zebra thermal printer (ZD230, ZD420, etc.)",
                  "Connected to network with IP address",
                  "Port 9100 accessible (default ZPL port)",
                ].map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-gray-300"
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Monitor className="w-4 h-4 text-indigo-300" />
                Computer
              </h3>
              <ul className="space-y-2">
                {[
                  "macOS 10.15+ or Windows 10+",
                  "Connected to same network as printer",
                  "USB barcode scanner (optional)",
                ].map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-gray-300"
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="bg-gray-800/50 outline outline-1 -outline-offset-1 outline-white/10 rounded-lg p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-300" />
            Settings you&apos;ll need
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white/5 outline outline-1 -outline-offset-1 outline-white/5 rounded-md p-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Server URL
              </p>
              <p className="mt-1.5 text-sm text-white font-mono break-all">{serverUrl}</p>
              <p className="mt-1 text-xs text-gray-500">Your event management website</p>
            </div>
            <div className="bg-white/5 outline outline-1 -outline-offset-1 outline-white/5 rounded-md p-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Printer IP (example)
              </p>
              <p className="mt-1.5 text-sm text-white font-mono">10.0.1.12</p>
              <p className="mt-1 text-xs text-gray-500">Ask IT or check printer config label</p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-300" />
            Frequently asked questions
          </h2>

          <Accordion
            type="single"
            collapsible
            className="bg-gray-800/50 outline outline-1 -outline-offset-1 outline-white/10 rounded-lg overflow-hidden divide-y divide-white/5"
          >
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border-0 px-5"
              >
                <AccordionTrigger className="text-white hover:no-underline text-sm font-medium [&_svg]:text-gray-400 py-4">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-gray-300 leading-relaxed pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Support */}
        <div className="text-center text-sm text-gray-500">
          Need help? Contact support at{" "}
          <a
            href={`mailto:${COMPANY_CONFIG.supportEmail}`}
            className="text-indigo-300 hover:text-indigo-200 hover:underline"
          >
            {COMPANY_CONFIG.supportEmail}
          </a>
        </div>
      </div>
    </div>
  )
}
