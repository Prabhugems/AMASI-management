"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  ChevronRight,
  Edit,
  Trash2,
  Star,
  ListTodo,
  Tag,
  Timer,
  CheckCheck,
} from "lucide-react"
import Link from "next/link"

// ============================================
// PRIORITY BADGE
// ============================================
function PriorityBadge({ priority, isDark }: { priority: string; isDark: boolean }) {
  const config: Record<string, { bg: string; text: string; border: string; icon: string; label: string }> = {
    urgent: {
      bg: isDark ? "bg-rose-500/20" : "bg-rose-100",
      text: isDark ? "text-rose-400" : "text-rose-700",
      border: isDark ? "border-rose-500/30" : "border-rose-200",
      icon: "🔴",
      label: "Urgent",
    },
    high: {
      bg: isDark ? "bg-amber-500/20" : "bg-amber-100",
      text: isDark ? "text-amber-400" : "text-amber-700",
      border: isDark ? "border-amber-500/30" : "border-amber-200",
      icon: "🟠",
      label: "High",
    },
    medium: {
      bg: isDark ? "bg-blue-500/20" : "bg-blue-100",
      text: isDark ? "text-blue-400" : "text-blue-700",
      border: isDark ? "border-blue-500/30" : "border-blue-200",
      icon: "🔵",
      label: "Medium",
    },
    low: {
      bg: isDark ? "bg-slate-500/20" : "bg-gray-100",
      text: isDark ? "text-slate-400" : "text-gray-600",
      border: isDark ? "border-slate-500/30" : "border-gray-200",
      icon: "⚪",
      label: "Low",
    },
  }

  const priorityConfig = config[priority] || config.medium

  return (
    <span
      className={`
      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold
      border ${priorityConfig.bg} ${priorityConfig.text} ${priorityConfig.border}
    `}
    >
      <span className="text-[10px]">{priorityConfig.icon}</span>
      {priorityConfig.label}
    </span>
  )
}

// ============================================
// DUE DATE BADGE
// ============================================
function DueDateBadge({ daysLeft, isDark }: { daysLeft: number; isDark: boolean }) {
  const isOverdue = daysLeft < 0
  const isDueToday = daysLeft === 0
  const isDueSoon = daysLeft > 0 && daysLeft <= 2

  let config: { bg: string; text: string; label: string; icon: typeof AlertTriangle }
  if (isOverdue) {
    config = {
      bg: isDark ? "bg-rose-500/20" : "bg-rose-100",
      text: isDark ? "text-rose-400" : "text-rose-700",
      label: `${Math.abs(daysLeft)}d overdue`,
      icon: AlertTriangle,
    }
  } else if (isDueToday) {
    config = {
      bg: isDark ? "bg-amber-500/20" : "bg-amber-100",
      text: isDark ? "text-amber-400" : "text-amber-700",
      label: "Due today",
      icon: Timer,
    }
  } else if (isDueSoon) {
    config = {
      bg: isDark ? "bg-amber-500/20" : "bg-amber-100",
      text: isDark ? "text-amber-400" : "text-amber-700",
      label: `${daysLeft}d left`,
      icon: Clock,
    }
  } else {
    config = {
      bg: isDark ? "bg-slate-500/10" : "bg-gray-50",
      text: isDark ? "text-slate-400" : "text-gray-500",
      label: `${daysLeft}d left`,
      icon: Calendar,
    }
  }

  const Icon = config.icon

  return (
    <span
      className={`
      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
      ${config.bg} ${config.text}
    `}
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  )
}

// ============================================
// CATEGORY TAG
// ============================================
function CategoryTag({ category, isDark }: { category: string; isDark: boolean }) {
  const colors: Record<string, string> = {
    Faculty: "bg-primary-20 text-primary", // Uses theme primary
    Finance: isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700",
    Logistics: isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700",
    Marketing: isDark ? "bg-rose-500/20 text-rose-400" : "bg-rose-100 text-rose-700",
    Registration: isDark ? "bg-cyan-500/20 text-cyan-400" : "bg-cyan-100 text-cyan-700",
    Venue: isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700",
  }

  const colorClass = colors[category] || (isDark ? "bg-slate-500/20 text-slate-400" : "bg-gray-100 text-gray-600")

  return (
    <span
      className={`
      inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium
      ${colorClass}
    `}
    >
      <Tag className="w-3 h-3" />
      {category}
    </span>
  )
}

// ============================================
// ASSIGNEE AVATAR
// ============================================
function AssigneeAvatar({ name, color, isDark }: { name: string; color: string; isDark: boolean }) {
  const colors: Record<string, string> = {
    emerald: "from-emerald-500 to-teal-600",
    amber: "from-amber-500 to-orange-600",
    rose: "from-rose-500 to-pink-600",
    blue: "from-blue-500 to-cyan-600",
  }

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  // Use theme primary for violet, otherwise use preset gradients
  const isPrimary = color === "violet"

  return (
    <div
      className={`
      w-7 h-7 rounded-full
      ${isPrimary ? "bg-gradient-primary" : `bg-gradient-to-br ${colors[color] || ""}`}
      flex items-center justify-center
      text-[10px] font-bold text-white
      ring-2 ${isDark ? "ring-slate-800" : "ring-white"}
    `}
    >
      {initials}
    </div>
  )
}

// ============================================
// TASK CARD
// ============================================
interface Task {
  id: number
  title: string
  description?: string
  priority: string
  dueDate: string
  daysLeft: number
  category: string
  assignee: string
  assigneeColor: string
  starred: boolean
  completed: boolean
  subtasks?: number
  subtasksCompleted?: number
}

function TaskCard({
  task,
  index,
  isDark,
  onToggle,
}: {
  task: Task
  index: number
  isDark: boolean
  onToggle: (id: number) => void
}) {
  const [isVisible, setIsVisible] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 80)
    return () => clearTimeout(timer)
  }, [index])

  const handleToggle = () => {
    setIsChecking(true)
    setTimeout(() => {
      onToggle(task.id)
      setIsChecking(false)
    }, 400)
  }

  const priorityColors: Record<string, string> = {
    urgent: "bg-rose-500",
    high: "bg-amber-500",
    medium: "bg-blue-500",
    low: "bg-slate-400",
  }

  const priorityGlowColors: Record<string, string> = {
    urgent: "from-rose-500/5",
    high: "from-amber-500/5",
    medium: "from-blue-500/5",
    low: "from-slate-500/5",
  }

  return (
    <div
      className={`
        group relative overflow-hidden rounded-xl cursor-pointer
        transition-all duration-500 ease-out
        ${isVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95"}
        ${task.completed ? "opacity-60" : ""}
        ${isHovered ? "scale-[1.01] -translate-y-0.5" : ""}
        ${
          isDark
            ? "bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 hover:border-slate-600"
            : "bg-white border border-gray-200 hover:shadow-lg hover:shadow-gray-200/50"
        }
      `}
      style={{ transitionDelay: `${index * 80}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Priority Left Bar */}
      <div
        className={`
        absolute left-0 top-0 bottom-0 w-1 transition-all duration-300
        ${priorityColors[task.priority] || priorityColors.medium}
        ${isHovered ? "w-1.5" : ""}
      `}
      />

      {/* Hover Glow */}
      <div
        className={`
        absolute inset-0 bg-gradient-to-r
        ${priorityGlowColors[task.priority] || priorityGlowColors.medium}
        via-transparent to-transparent
        transition-opacity duration-300
        ${isHovered ? "opacity-100" : "opacity-0"}
      `}
      />

      <div className="relative z-10 p-4">
        <div className="flex items-start gap-4">
          {/* Checkbox */}
          <button
            onClick={handleToggle}
            className={`
              relative flex-shrink-0 mt-0.5
              transition-all duration-300
              ${isHovered ? "scale-110" : ""}
            `}
          >
            {task.completed ? (
              <div
                className={`
                w-6 h-6 rounded-full flex items-center justify-center
                bg-emerald-500 text-white
                ${isChecking ? "animate-bounce" : ""}
              `}
              >
                <CheckCircle2 className="w-4 h-4" />
              </div>
            ) : (
              <div
                className={`
                w-6 h-6 rounded-full border-2 flex items-center justify-center
                transition-all duration-300
                ${
                  isDark
                    ? "border-slate-600 hover:border-emerald-500 hover:bg-emerald-500/10"
                    : "border-gray-300 hover:border-emerald-500 hover:bg-emerald-50"
                }
                ${isChecking ? "border-emerald-500 bg-emerald-500 scale-110" : ""}
              `}
              >
                {isChecking && <CheckCircle2 className="w-4 h-4 text-white" />}
              </div>
            )}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title Row */}
            <div className="flex items-start justify-between gap-4 mb-2">
              <h3
                className={`
                font-semibold leading-tight transition-all duration-300
                ${task.completed ? "line-through" : ""}
                ${isDark ? "text-white" : "text-gray-900"}
                ${isHovered && !task.completed ? "translate-x-1" : ""}
              `}
              >
                {task.title}
              </h3>

              {/* Starred */}
              {task.starred && (
                <Star className={`w-4 h-4 flex-shrink-0 fill-current ${isDark ? "text-amber-400" : "text-amber-500"}`} />
              )}
            </div>

            {/* Description */}
            {task.description && (
              <p className={`text-sm mb-3 line-clamp-2 ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                {task.description}
              </p>
            )}

            {/* Meta Row */}
            <div className="flex items-center flex-wrap gap-2">
              <DueDateBadge daysLeft={task.daysLeft} isDark={isDark} />
              <PriorityBadge priority={task.priority} isDark={isDark} />
              <CategoryTag category={task.category} isDark={isDark} />
            </div>
          </div>

          {/* Right Side */}
          <div className="flex flex-col items-end gap-3">
            {/* Assignee */}
            <AssigneeAvatar name={task.assignee} color={task.assigneeColor} isDark={isDark} />

            {/* Actions */}
            <div
              className={`
              flex items-center gap-1 transition-all duration-300
              ${isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
            `}
            >
              <button
                className={`
                p-1.5 rounded-lg transition-colors
                ${
                  isDark
                    ? "hover:bg-slate-700 text-slate-400 hover:text-white"
                    : "hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                }
              `}
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                className={`
                p-1.5 rounded-lg transition-colors
                ${
                  isDark
                    ? "hover:bg-slate-700 text-slate-400 hover:text-rose-400"
                    : "hover:bg-gray-100 text-gray-400 hover:text-rose-600"
                }
              `}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Subtasks Progress */}
        {task.subtasks && (
          <div className={`mt-3 pt-3 border-t ${isDark ? "border-slate-700/50" : "border-gray-100"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-gray-500"}`}>Subtasks</span>
              <span className={`text-xs font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                {task.subtasksCompleted}/{task.subtasks}
              </span>
            </div>
            <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? "bg-slate-700" : "bg-gray-200"}`}>
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-1000"
                style={{ width: `${((task.subtasksCompleted || 0) / task.subtasks) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Shine Effect */}
      <div
        className={`
        absolute inset-0 -translate-x-full
        bg-gradient-to-r from-transparent via-white/10 to-transparent
        transition-transform duration-700 skew-x-12
        ${isHovered ? "translate-x-full" : ""}
      `}
      />
    </div>
  )
}

// ============================================
// STATS PILL
// ============================================
function StatsPill({
  icon: Icon,
  value,
  label,
  bg,
  iconColor,
  isDark,
  index,
}: {
  icon: typeof ListTodo
  value: number
  label: string
  bg: string
  iconColor: string
  isDark: boolean
  index: number
}) {
  const [isHovered, setIsHovered] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [count, setCount] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 100)
    return () => clearTimeout(timer)
  }, [index])

  // Counter animation
  useEffect(() => {
    if (!isVisible) return

    const duration = 1000
    const steps = 20
    const increment = value / steps
    let current = 0

    const timer = setInterval(() => {
      current += increment
      if (current >= value) {
        setCount(value)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, duration / steps)

    return () => clearInterval(timer)
  }, [isVisible, value])

  return (
    <div
      className={`
        relative overflow-hidden p-3 rounded-xl transition-all duration-500
        ${bg}
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
        ${isHovered ? "scale-105 shadow-lg" : ""}
      `}
      style={{ transitionDelay: `${index * 100}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-2">
        <div
          className={`
          p-1.5 rounded-lg transition-transform duration-300
          ${isDark ? "bg-white/5" : "bg-white"}
          ${isHovered ? "scale-110 rotate-6" : ""}
        `}
        >
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div>
          <p className={`text-lg font-black ${isDark ? "text-white" : "text-gray-900"}`}>{count}</p>
          <p className={`text-[10px] font-medium ${isDark ? "text-slate-400" : "text-gray-500"}`}>{label}</p>
        </div>
      </div>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================
export function TasksWidget() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === "dark" : false

  const [tasks, setTasks] = useState<Task[]>([
    {
      id: 1,
      title: "Finalize AMASICON 2026 Venue Contract",
      description: "Review and sign the final contract with Marriott Jaipur",
      priority: "urgent",
      dueDate: "Jan 5, 2026",
      daysLeft: 2,
      category: "Venue",
      assignee: "Prabhu",
      assigneeColor: "violet",
      starred: true,
      completed: false,
      subtasks: 4,
      subtasksCompleted: 3,
    },
    {
      id: 2,
      title: "Send Faculty Invitation Reminders",
      description: "Follow up with 12 faculty who haven't responded",
      priority: "high",
      dueDate: "Jan 4, 2026",
      daysLeft: 1,
      category: "Faculty",
      assignee: "Priya Singh",
      assigneeColor: "rose",
      starred: false,
      completed: false,
    },
    {
      id: 3,
      title: "Submit Q3 TDS Returns",
      description: "Prepare and file TDS returns for Q3 - Rs.2,45,000",
      priority: "high",
      dueDate: "Jan 8, 2026",
      daysLeft: 5,
      category: "Finance",
      assignee: "Amit Kumar",
      assigneeColor: "amber",
      starred: true,
      completed: false,
      subtasks: 3,
      subtasksCompleted: 1,
    },
    {
      id: 4,
      title: "Confirm Hotel Room Blocks",
      description: "Finalize remaining 15 room reservations",
      priority: "urgent",
      dueDate: "Jan 3, 2026",
      daysLeft: 0,
      category: "Logistics",
      assignee: "Prabhu",
      assigneeColor: "violet",
      starred: false,
      completed: false,
    },
  ])

  const handleToggleTask = (taskId: number) => {
    setTasks(tasks.map((task) => (task.id === taskId ? { ...task, completed: !task.completed } : task)))
  }

  const total = tasks.length
  const completed = tasks.filter((t) => t.completed).length
  const overdue = tasks.filter((t) => t.daysLeft < 0 && !t.completed).length
  const dueToday = tasks.filter((t) => t.daysLeft === 0 && !t.completed).length
  const urgent = tasks.filter((t) => t.priority === "urgent" && !t.completed).length

  const stats = [
    {
      icon: ListTodo,
      value: total,
      label: "Total",
      bg: "bg-primary-10",
      iconColor: "text-primary",
    },
    {
      icon: CheckCheck,
      value: completed,
      label: "Done",
      bg: isDark ? "bg-emerald-500/10" : "bg-emerald-50",
      iconColor: isDark ? "text-emerald-400" : "text-emerald-600",
    },
    {
      icon: Timer,
      value: dueToday,
      label: "Today",
      bg: isDark ? "bg-amber-500/10" : "bg-amber-50",
      iconColor: isDark ? "text-amber-400" : "text-amber-600",
    },
    {
      icon: AlertTriangle,
      value: overdue,
      label: "Overdue",
      bg: isDark ? "bg-rose-500/10" : "bg-rose-50",
      iconColor: isDark ? "text-rose-400" : "text-rose-600",
    },
  ]

  return (
    <div
      className={`
      rounded-2xl overflow-hidden
      ${isDark ? "bg-slate-900/50 border border-slate-800 backdrop-blur-sm" : "bg-white border border-gray-200 shadow-xl shadow-gray-200/50"}
    `}
    >
      {/* Header */}
      <div className={`flex items-center justify-between p-5 ${isDark ? "bg-slate-800/50" : "bg-gray-50"}`}>
        <div className="flex items-center gap-4">
          <div className="relative p-3 rounded-xl bg-primary-20">
            <ListTodo className="relative w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Tasks</h2>
            <p className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>Upcoming deadlines</p>
          </div>
        </div>

        {urgent > 0 && (
          <div
            className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold
            ${isDark ? "bg-rose-500/20 text-rose-400" : "bg-rose-100 text-rose-700"}
          `}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {urgent} urgent
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-2 p-4">
        {stats.map((stat, i) => (
          <StatsPill key={i} {...stat} isDark={isDark} index={i} />
        ))}
      </div>

      {/* Tasks List */}
      <div className="px-4 pb-4 space-y-3 max-h-[400px] overflow-y-auto">
        {tasks
          .filter((t) => !t.completed)
          .map((task, index) => (
            <TaskCard key={task.id} task={task} index={index} isDark={isDark} onToggle={handleToggleTask} />
          ))}
      </div>

      {/* Footer */}
      <div
        className={`
        flex items-center justify-center p-4
        border-t cursor-pointer transition-all duration-300
        ${isDark ? "border-slate-700/50 hover:bg-slate-800/50" : "border-gray-100 hover:bg-gray-50"}
      `}
      >
        <Link
          href="/tasks"
          className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          View all tasks
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
