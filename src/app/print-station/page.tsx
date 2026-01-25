"use client"

import { useState } from "react"
import { Download, Monitor, Apple, CheckCircle, Printer, ScanLine, Settings, HelpCircle } from "lucide-react"

export default function PrintStationDownloadPage() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  // Update these URLs after uploading to GitHub Releases
  // For now, files are in: print-station-app/dist/
  const DOWNLOAD_URLS = {
    mac: "#mac-download",  // Will be updated after GitHub upload
    windows: "#windows-download"  // Will be updated after GitHub upload
  }

  const [showInstructions, setShowInstructions] = useState(false)

  const steps = [
    {
      icon: Download,
      title: "Download & Install",
      description: "Download the app for your operating system and install it"
    },
    {
      icon: Settings,
      title: "Configure Settings",
      description: "Enter your server URL and printer IP address in Settings tab"
    },
    {
      icon: ScanLine,
      title: "Scan QR Codes",
      description: "Use a USB barcode scanner or type registration codes"
    },
    {
      icon: Printer,
      title: "Print Badges",
      description: "Click Print Badge to send directly to your Zebra printer"
    }
  ]

  const faqs = [
    {
      question: "What printer do I need?",
      answer: "You need a Zebra thermal printer (ZD230, ZD420, or similar) connected to your network. The printer must have a network IP address (e.g., 10.0.1.12)."
    },
    {
      question: "How do I find my printer's IP address?",
      answer: "Print a configuration label from your Zebra printer (hold the feed button for 2 seconds). The IP address will be listed under 'Network Configuration'. Or ask your IT team."
    },
    {
      question: "What is the Server URL?",
      answer: "This is your AMASI event management website URL (e.g., https://amasi-events.vercel.app). This is where the app fetches registration data from."
    },
    {
      question: "Can I use a USB barcode scanner?",
      answer: "Yes! USB barcode scanners work like keyboards - just scan the QR code and it will automatically type the code into the app."
    },
    {
      question: "The printer is not connecting?",
      answer: "1. Make sure your laptop is on the same network as the printer. 2. Check the printer IP is correct. 3. Try pinging the printer from terminal/command prompt. 4. Contact IT if the issue persists."
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-800/50 border-b border-slate-700">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Printer className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">AMASI Print Station</h1>
              <p className="text-slate-400">On-spot Badge Printing Application</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Download Section */}
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-8 mb-12">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">
            Download for your operating system
          </h2>

          {/* Notice for Admin */}
          <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl p-4 mb-6 max-w-2xl mx-auto">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <HelpCircle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-amber-200 font-medium text-sm">For IT Admin</p>
                <p className="text-amber-300/70 text-sm mt-1">
                  The installer file is located at: <code className="bg-slate-800 px-2 py-0.5 rounded">print-station-app/dist/</code>
                </p>
                <p className="text-amber-300/70 text-sm mt-1">
                  Upload to GitHub Releases or share via Google Drive with your staff.
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Mac Download */}
            <div
              className="flex items-center gap-4 p-6 bg-slate-700/50 rounded-xl border border-slate-600 group"
            >
              <div className="w-14 h-14 bg-slate-600 rounded-xl flex items-center justify-center">
                <Apple className="w-8 h-8 text-white" />
              </div>
              <div>
                <div className="text-white font-semibold text-lg">Mac App</div>
                <div className="text-slate-400 text-sm">AMASI Print Station-1.0.0-arm64.dmg</div>
                <div className="text-emerald-400 text-xs mt-1">✓ Built and ready</div>
              </div>
            </div>

            {/* Windows Download */}
            <div
              className="flex items-center gap-4 p-6 bg-slate-700/50 rounded-xl border border-slate-600 group"
            >
              <div className="w-14 h-14 bg-slate-600 rounded-xl flex items-center justify-center">
                <Monitor className="w-8 h-8 text-white" />
              </div>
              <div>
                <div className="text-white font-semibold text-lg">Windows App</div>
                <div className="text-slate-400 text-sm">.exe installer</div>
                <div className="text-slate-500 text-xs mt-1">Run: npm run build:win</div>
              </div>
            </div>
          </div>

          <p className="text-center text-slate-500 text-sm mt-6">
            Version 1.0.0 • Requires macOS 10.15+ or Windows 10+
          </p>
        </div>

        {/* How It Works */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-white mb-6">How It Works</h2>

          <div className="grid md:grid-cols-4 gap-6">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                  <div className="w-10 h-10 bg-indigo-600/20 rounded-lg flex items-center justify-center mb-4">
                    <step.icon className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div className="text-xs text-indigo-400 font-medium mb-1">Step {index + 1}</div>
                  <h3 className="text-white font-medium mb-2">{step.title}</h3>
                  <p className="text-slate-400 text-sm">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-0.5 bg-slate-700" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Requirements */}
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-8 mb-12">
          <h2 className="text-xl font-semibold text-white mb-6">Requirements</h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-400" />
                Printer
              </h3>
              <ul className="space-y-2">
                {[
                  "Zebra thermal printer (ZD230, ZD420, etc.)",
                  "Connected to network with IP address",
                  "Port 9100 accessible (default ZPL port)"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                <Monitor className="w-4 h-4 text-indigo-400" />
                Computer
              </h3>
              <ul className="space-y-2">
                {[
                  "macOS 10.15+ or Windows 10+",
                  "Connected to same network as printer",
                  "USB barcode scanner (optional)"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Settings Info */}
        <div className="bg-indigo-900/30 rounded-2xl border border-indigo-800/50 p-8 mb-12">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            Settings You'll Need
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="text-slate-400 text-sm mb-1">Server URL</div>
              <div className="text-white font-mono text-sm">https://amasi-events.vercel.app</div>
              <div className="text-slate-500 text-xs mt-1">Your event management website</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="text-slate-400 text-sm mb-1">Printer IP (Example)</div>
              <div className="text-white font-mono text-sm">10.0.1.12</div>
              <div className="text-slate-500 text-xs mt-1">Ask IT or check printer config label</div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-400" />
            Frequently Asked Questions
          </h2>

          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-slate-700/50 transition-colors"
                >
                  <span className="text-white font-medium">{faq.question}</span>
                  <span className="text-slate-400 text-xl">
                    {expandedFaq === index ? "−" : "+"}
                  </span>
                </button>
                {expandedFaq === index && (
                  <div className="px-6 pb-4 text-slate-300 text-sm">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Support */}
        <div className="mt-12 text-center text-slate-500 text-sm">
          Need help? Contact support at <a href="mailto:support@amasi.org" className="text-indigo-400 hover:underline">support@amasi.org</a>
        </div>
      </div>
    </div>
  )
}
