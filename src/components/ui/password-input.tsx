"use client"

import * as React from "react"
import { Eye, EyeOff, Check, X, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  getPasswordStrength,
  checkRequirements,
  defaultRequirements,
  generatePassword,
  type PasswordRequirement,
} from "@/lib/password-strength"

interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  showStrength?: boolean
  showRequirements?: boolean
  requirements?: PasswordRequirement[]
  onStrengthChange?: (score: number) => void
  showGenerator?: boolean
  onGenerate?: (password: string) => void
}

/**
 * Password Input Component
 *
 * Password input with visibility toggle, strength meter, and requirements
 *
 * Usage:
 * ```
 * <PasswordInput
 *   value={password}
 *   onChange={(e) => setPassword(e.target.value)}
 *   showStrength
 *   showRequirements
 * />
 * ```
 */
export function PasswordInput({
  value,
  onChange,
  showStrength = false,
  showRequirements = false,
  requirements = defaultRequirements,
  onStrengthChange,
  showGenerator = false,
  onGenerate,
  className,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = React.useState(false)
  const password = String(value || "")

  const strength = React.useMemo(
    () => getPasswordStrength(password),
    [password]
  )

  const requirementStatus = React.useMemo(
    () => checkRequirements(password, requirements),
    [password, requirements]
  )

  React.useEffect(() => {
    onStrengthChange?.(strength.score)
  }, [strength.score, onStrengthChange])

  const handleGenerate = () => {
    const newPassword = generatePassword(16)
    if (onGenerate) {
      onGenerate(newPassword)
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={onChange}
          className={cn("pr-20", className)}
          {...props}
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {showGenerator && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleGenerate}
              tabIndex={-1}
            >
              <RefreshCw className="h-4 w-4" />
              <span className="sr-only">Generate password</span>
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            <span className="sr-only">
              {showPassword ? "Hide password" : "Show password"}
            </span>
          </Button>
        </div>
      </div>

      {showStrength && password && (
        <PasswordStrengthMeter strength={strength} />
      )}

      {showRequirements && password && (
        <PasswordRequirementsList
          requirements={requirements}
          passed={requirementStatus.passed}
        />
      )}
    </div>
  )
}

/**
 * Password strength meter
 */
export function PasswordStrengthMeter({
  strength,
  className,
}: {
  strength: ReturnType<typeof getPasswordStrength>
  className?: string
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              level <= strength.score ? strength.color : "bg-muted"
            )}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs">
        <span
          className={cn(
            strength.score <= 1 && "text-red-600",
            strength.score === 2 && "text-yellow-600",
            strength.score >= 3 && "text-green-600"
          )}
        >
          {strength.label}
        </span>
        {strength.feedback.length > 0 && (
          <span className="text-muted-foreground">
            {strength.feedback[0]}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Password requirements list
 */
export function PasswordRequirementsList({
  requirements,
  passed,
  className,
}: {
  requirements: PasswordRequirement[]
  passed: string[]
  className?: string
}) {
  return (
    <ul className={cn("space-y-1", className)}>
      {requirements.map((req) => {
        const isPassed = passed.includes(req.id)
        return (
          <li
            key={req.id}
            className={cn(
              "flex items-center gap-2 text-xs",
              isPassed ? "text-green-600" : "text-muted-foreground"
            )}
          >
            {isPassed ? (
              <Check className="h-3 w-3" />
            ) : (
              <X className="h-3 w-3" />
            )}
            {req.label}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Confirm password input
 */
export function ConfirmPasswordInput({
  password,
  confirmPassword,
  onConfirmChange,
  className,
}: {
  password: string
  confirmPassword: string
  onConfirmChange: (value: string) => void
  className?: string
}) {
  const [showPassword, setShowPassword] = React.useState(false)
  const matches = password === confirmPassword && confirmPassword.length > 0

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <Input
          type={showPassword ? "text" : "password"}
          value={confirmPassword}
          onChange={(e) => onConfirmChange(e.target.value)}
          placeholder="Confirm password"
          className={cn(
            "pr-10",
            confirmPassword &&
              (matches
                ? "border-green-500 focus-visible:ring-green-500"
                : "border-red-500 focus-visible:ring-red-500")
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
          onClick={() => setShowPassword(!showPassword)}
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
      </div>
      {confirmPassword && !matches && (
        <p className="text-xs text-red-600">Passwords do not match</p>
      )}
    </div>
  )
}

/**
 * Password change form component
 */
export function PasswordChangeFields({
  currentPassword,
  newPassword,
  confirmPassword,
  onCurrentChange,
  onNewChange,
  onConfirmChange,
  showCurrentPassword = true,
  className,
}: {
  currentPassword?: string
  newPassword: string
  confirmPassword: string
  onCurrentChange?: (value: string) => void
  onNewChange: (value: string) => void
  onConfirmChange: (value: string) => void
  showCurrentPassword?: boolean
  className?: string
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {showCurrentPassword && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Current Password</label>
          <PasswordInput
            value={currentPassword}
            onChange={(e) => onCurrentChange?.(e.target.value)}
            placeholder="Enter current password"
          />
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">New Password</label>
        <PasswordInput
          value={newPassword}
          onChange={(e) => onNewChange(e.target.value)}
          placeholder="Enter new password"
          showStrength
          showRequirements
          showGenerator
          onGenerate={onNewChange}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Confirm New Password</label>
        <ConfirmPasswordInput
          password={newPassword}
          confirmPassword={confirmPassword}
          onConfirmChange={onConfirmChange}
        />
      </div>
    </div>
  )
}
