"use client"

import { useEffect, useCallback, useRef, useState } from "react"
import { useLocalStorage } from "./use-local-storage"

/**
 * Hook for persisting form state to prevent data loss
 *
 * Usage:
 * ```
 * const { saveState, clearState, hasRestoredState } = useFormPersistence(
 *   "event-form",
 *   form.getValues,
 *   (values) => form.reset(values)
 * )
 *
 * // Auto-save on change
 * useEffect(() => {
 *   const subscription = form.watch((values) => saveState(values))
 *   return () => subscription.unsubscribe()
 * }, [form, saveState])
 *
 * // Clear on successful submit
 * const onSubmit = async (data) => {
 *   await saveToServer(data)
 *   clearState()
 * }
 * ```
 */
export function useFormPersistence<T extends Record<string, any>>(
  formKey: string,
  getCurrentValues: () => T,
  restoreValues: (values: T) => void,
  options: {
    debounceMs?: number
    excludeFields?: (keyof T)[]
    onRestore?: (values: T) => void
  } = {}
) {
  const { debounceMs = 1000, excludeFields = [], onRestore } = options
  const [storedValues, setStoredValues, removeStoredValues] = useLocalStorage<T | null>(
    `form:${formKey}`,
    null
  )
  const hasRestoredRef = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Restore values on mount
  useEffect(() => {
    if (storedValues && !hasRestoredRef.current) {
      hasRestoredRef.current = true
      restoreValues(storedValues)
      onRestore?.(storedValues)
    }
  }, [storedValues, restoreValues, onRestore])

  // Save state with debouncing
  const saveState = useCallback(
    (values?: T) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        const currentValues = values || getCurrentValues()

        // Filter out excluded fields
        if (excludeFields.length > 0) {
          const filtered = { ...currentValues }
          for (const field of excludeFields) {
            delete filtered[field]
          }
          setStoredValues(filtered as T)
        } else {
          setStoredValues(currentValues)
        }
      }, debounceMs)
    },
    [getCurrentValues, setStoredValues, debounceMs, excludeFields]
  )

  // Clear state
  const clearState = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    removeStoredValues()
    hasRestoredRef.current = false
  }, [removeStoredValues])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    saveState,
    clearState,
    hasRestoredState: hasRestoredRef.current && storedValues !== null,
    storedValues,
  }
}

/**
 * Hook for simple input field persistence
 *
 * Usage:
 * ```
 * const [value, setValue] = usePersistedInput("search-query", "")
 * ```
 */
export function usePersistedInput<T = string>(
  key: string,
  defaultValue: T
): [T, (value: T) => void, () => void] {
  const [value, setValue, clear] = useLocalStorage<T>(`input:${key}`, defaultValue)
  return [value, setValue, clear]
}

/**
 * Hook for tracking unsaved changes
 *
 * Usage:
 * ```
 * const { isDirty, setIsDirty, confirmLeave } = useUnsavedChanges()
 *
 * // Mark as dirty when form changes
 * form.watch(() => setIsDirty(true))
 *
 * // Clear on save
 * const onSubmit = async (data) => {
 *   await saveToServer(data)
 *   setIsDirty(false)
 * }
 * ```
 */
export function useUnsavedChanges(options: { message?: string } = {}) {
  const { message = "You have unsaved changes. Are you sure you want to leave?" } = options
  const [isDirty, setIsDirtyState] = useState(false)
  const isDirtyRef = useRef(false)

  // Handle browser/tab close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault()
        e.returnValue = message
        return message
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [message])

  const setIsDirty = useCallback((dirty: boolean) => {
    isDirtyRef.current = dirty
    setIsDirtyState(dirty)
  }, [])

  const confirmLeave = useCallback((): boolean => {
    if (!isDirtyRef.current) return true
    return window.confirm(message)
  }, [message])

  return {
    isDirty,
    setIsDirty,
    confirmLeave,
  }
}

/**
 * Hook for form step persistence (multi-step forms)
 *
 * Usage:
 * ```
 * const { currentStep, setCurrentStep, stepData, setStepData, clearAll } = useMultiStepForm("registration")
 *
 * // Save step data
 * const handleNext = (data) => {
 *   setStepData(currentStep, data)
 *   setCurrentStep(currentStep + 1)
 * }
 * ```
 */
export function useMultiStepForm<T extends Record<string, any>>(formKey: string) {
  const [currentStep, setCurrentStep, clearStep] = useLocalStorage<number>(
    `multistep:${formKey}:step`,
    0
  )
  const [stepData, setStepDataStorage, clearStepData] = useLocalStorage<Record<number, T>>(
    `multistep:${formKey}:data`,
    {}
  )

  const setStepData = useCallback(
    (step: number, data: T) => {
      setStepDataStorage((prev) => ({
        ...prev,
        [step]: data,
      }))
    },
    [setStepDataStorage]
  )

  const getStepData = useCallback(
    (step: number): T | undefined => {
      return stepData[step]
    },
    [stepData]
  )

  const getAllData = useCallback((): Partial<T>[] => {
    return Object.values(stepData)
  }, [stepData])

  const clearAll = useCallback(() => {
    clearStep()
    clearStepData()
  }, [clearStep, clearStepData])

  return {
    currentStep,
    setCurrentStep,
    stepData,
    setStepData,
    getStepData,
    getAllData,
    clearAll,
  }
}
