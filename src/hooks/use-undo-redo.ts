"use client"

import { useState, useCallback, useRef } from "react"

interface UseUndoRedoOptions<T> {
  maxHistory?: number
  onUndo?: (state: T) => void
  onRedo?: (state: T) => void
}

interface UseUndoRedoReturn<T> {
  state: T
  setState: (newState: T | ((prev: T) => T)) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  reset: (initialState: T) => void
  history: T[]
  historyIndex: number
}

/**
 * State with undo/redo support
 *
 * Usage:
 * ```
 * const { state, setState, undo, redo, canUndo, canRedo } = useUndoRedo(initialValue)
 *
 * <Button onClick={undo} disabled={!canUndo}>Undo</Button>
 * <Button onClick={redo} disabled={!canRedo}>Redo</Button>
 * ```
 */
export function useUndoRedo<T>(
  initialState: T,
  options: UseUndoRedoOptions<T> = {}
): UseUndoRedoReturn<T> {
  const { maxHistory = 50, onUndo, onRedo } = options

  const [history, setHistory] = useState<T[]>([initialState])
  const [historyIndex, setHistoryIndex] = useState(0)
  const isUndoRedoRef = useRef(false)

  const state = history[historyIndex]

  const setState = useCallback(
    (newState: T | ((prev: T) => T)) => {
      if (isUndoRedoRef.current) {
        isUndoRedoRef.current = false
        return
      }

      setHistory((prev) => {
        const currentState = prev[historyIndex]
        const resolvedState =
          typeof newState === "function"
            ? (newState as (prev: T) => T)(currentState)
            : newState

        // Don't add to history if state hasn't changed
        if (JSON.stringify(resolvedState) === JSON.stringify(currentState)) {
          return prev
        }

        // Remove any future history (after current index)
        const newHistory = prev.slice(0, historyIndex + 1)

        // Add new state
        newHistory.push(resolvedState)

        // Limit history size
        if (newHistory.length > maxHistory) {
          newHistory.shift()
          return newHistory
        }

        return newHistory
      })

      setHistoryIndex((prev) => Math.min(prev + 1, maxHistory - 1))
    },
    [historyIndex, maxHistory]
  )

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoRef.current = true
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      onUndo?.(history[newIndex])
    }
  }, [historyIndex, history, onUndo])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoRef.current = true
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      onRedo?.(history[newIndex])
    }
  }, [historyIndex, history, onRedo])

  const reset = useCallback((newInitialState: T) => {
    setHistory([newInitialState])
    setHistoryIndex(0)
  }, [])

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  return {
    state,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    history,
    historyIndex,
  }
}

/**
 * Undo/redo manager for complex state
 */
export class UndoManager<T> {
  private history: T[] = []
  private currentIndex = -1
  private maxHistory: number
  private listeners: Set<() => void> = new Set()

  constructor(maxHistory = 50) {
    this.maxHistory = maxHistory
  }

  push(state: T): void {
    // Remove future history
    this.history = this.history.slice(0, this.currentIndex + 1)

    // Add new state
    this.history.push(state)
    this.currentIndex++

    // Limit history size
    if (this.history.length > this.maxHistory) {
      this.history.shift()
      this.currentIndex--
    }

    this.notify()
  }

  undo(): T | undefined {
    if (this.canUndo()) {
      this.currentIndex--
      this.notify()
      return this.history[this.currentIndex]
    }
    return undefined
  }

  redo(): T | undefined {
    if (this.canRedo()) {
      this.currentIndex++
      this.notify()
      return this.history[this.currentIndex]
    }
    return undefined
  }

  canUndo(): boolean {
    return this.currentIndex > 0
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1
  }

  current(): T | undefined {
    return this.history[this.currentIndex]
  }

  clear(): void {
    this.history = []
    this.currentIndex = -1
    this.notify()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener())
  }
}
