"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Check, ChevronLeft, ChevronRight } from "lucide-react"

interface Step {
  id: string
  title: string
  description?: string
  optional?: boolean
}

interface StepWizardProps {
  steps: Step[]
  currentStep: number
  onStepChange?: (step: number) => void
  children: React.ReactNode
  className?: string
}

/**
 * Step Wizard Component
 *
 * Multi-step form with navigation
 *
 * Usage:
 * ```
 * <StepWizard
 *   steps={[
 *     { id: "info", title: "Basic Info" },
 *     { id: "details", title: "Details" },
 *     { id: "confirm", title: "Confirm" }
 *   ]}
 *   currentStep={step}
 *   onStepChange={setStep}
 * >
 *   {step === 0 && <BasicInfoForm />}
 *   {step === 1 && <DetailsForm />}
 *   {step === 2 && <ConfirmForm />}
 * </StepWizard>
 * ```
 */
export function StepWizard({
  steps,
  currentStep,
  onStepChange,
  children,
  className,
}: StepWizardProps) {
  const canGoBack = currentStep > 0
  const canGoNext = currentStep < steps.length - 1
  const isLastStep = currentStep === steps.length - 1

  return (
    <div className={cn("space-y-6", className)}>
      {/* Step indicators */}
      <StepIndicator steps={steps} currentStep={currentStep} />

      {/* Step content */}
      <div className="min-h-[200px]">{children}</div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button
          variant="outline"
          onClick={() => onStepChange?.(currentStep - 1)}
          disabled={!canGoBack}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {!isLastStep && (
          <Button onClick={() => onStepChange?.(currentStep + 1)}>
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Step indicator component
 */
export function StepIndicator({
  steps,
  currentStep,
  onStepClick,
  allowClick = false,
  className,
}: {
  steps: Step[]
  currentStep: number
  onStepClick?: (step: number) => void
  allowClick?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex items-center", className)}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep
        const isCurrent = index === currentStep
        const isPending = index > currentStep

        return (
          <React.Fragment key={step.id}>
            {/* Step */}
            <div
              className={cn(
                "flex items-center",
                allowClick && !isPending && "cursor-pointer"
              )}
              onClick={() => {
                if (allowClick && !isPending) {
                  onStepClick?.(index)
                }
              }}
            >
              {/* Circle */}
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors",
                  isCompleted && "bg-primary border-primary text-primary-foreground",
                  isCurrent && "border-primary text-primary",
                  isPending && "border-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>

              {/* Label */}
              <div className="ml-3 hidden sm:block">
                <p
                  className={cn(
                    "text-sm font-medium",
                    isPending && "text-muted-foreground"
                  )}
                >
                  {step.title}
                </p>
                {step.description && (
                  <p className="text-xs text-muted-foreground">
                    {step.description}
                  </p>
                )}
              </div>
            </div>

            {/* Connector */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-4",
                  isCompleted ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

/**
 * Vertical step indicator
 */
export function StepIndicatorVertical({
  steps,
  currentStep,
  className,
}: {
  steps: Step[]
  currentStep: number
  className?: string
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep
        const isCurrent = index === currentStep
        const isPending = index > currentStep
        const isLast = index === steps.length - 1

        return (
          <div key={step.id} className="flex gap-4">
            {/* Circle and line */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors",
                  isCompleted && "bg-primary border-primary text-primary-foreground",
                  isCurrent && "border-primary text-primary",
                  isPending && "border-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="text-xs font-medium">{index + 1}</span>
                )}
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "w-0.5 flex-1 min-h-[24px]",
                    isCompleted ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pb-4">
              <p
                className={cn(
                  "text-sm font-medium",
                  isPending && "text-muted-foreground"
                )}
              >
                {step.title}
                {step.optional && (
                  <span className="text-muted-foreground ml-1">(Optional)</span>
                )}
              </p>
              {step.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {step.description}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Controlled step wizard hook
 */
export function useStepWizard(totalSteps: number, initialStep: number = 0) {
  const [currentStep, setCurrentStep] = React.useState(initialStep)
  const [completedSteps, setCompletedSteps] = React.useState<Set<number>>(
    new Set()
  )

  const goToStep = React.useCallback(
    (step: number) => {
      if (step >= 0 && step < totalSteps) {
        setCurrentStep(step)
      }
    },
    [totalSteps]
  )

  const nextStep = React.useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCompletedSteps((prev) => new Set([...prev, currentStep]))
      setCurrentStep(currentStep + 1)
    }
  }, [currentStep, totalSteps])

  const prevStep = React.useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }, [currentStep])

  const markCompleted = React.useCallback((step: number) => {
    setCompletedSteps((prev) => new Set([...prev, step]))
  }, [])

  const reset = React.useCallback(() => {
    setCurrentStep(initialStep)
    setCompletedSteps(new Set())
  }, [initialStep])

  return {
    currentStep,
    completedSteps,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === totalSteps - 1,
    goToStep,
    nextStep,
    prevStep,
    markCompleted,
    reset,
  }
}
