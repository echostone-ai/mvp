/**
 * Onboarding Wizard Framework
 * Provides a reusable framework for creating multi-step onboarding experiences
 */

import React from 'react'

export interface WizardStep<TData = any> {
  id: string
  title: string
  description: string
  component: React.ComponentType<WizardStepProps<TData>>
  validation: (data: TData) => { isValid: boolean; errors: string[] }
  tips: string[]
  canSkip?: boolean
  requiredFields?: string[]
  onEnter?: (data: TData) => Promise<void> | void
  onExit?: (data: TData) => Promise<void> | void
}

export interface WizardStepProps<TData = any> {
  data: TData
  updateData: (updates: Partial<TData>) => void
  nextStep: () => void
  prevStep: () => void
  goToStep: (stepIndex: number) => void
  isValid: boolean
  errors: string[]
  currentStepIndex: number
  totalSteps: number
  isProcessing: boolean
  setProcessing: (processing: boolean) => void
}

export interface WizardState<TData = any> {
  currentStep: number
  data: TData
  isProcessing: boolean
  errors: string[]
  completedSteps: Set<number>
  skippedSteps: Set<number>
}

export interface WizardConfig<TData = any> {
  steps: WizardStep<TData>[]
  initialData: TData
  onComplete?: (data: TData) => Promise<void> | void
  onCancel?: (data: TData) => Promise<void> | void
  allowSkipping?: boolean
  persistState?: boolean
  storageKey?: string
}

export interface WizardActions<TData = any> {
  nextStep: () => void
  prevStep: () => void
  goToStep: (stepIndex: number) => void
  skipStep: () => void
  updateData: (updates: Partial<TData>) => void
  setProcessing: (processing: boolean) => void
  reset: () => void
  complete: () => void
  cancel: () => void
}

export interface WizardHookReturn<TData = any> {
  state: WizardState<TData>
  actions: WizardActions<TData>
  currentStep: WizardStep<TData>
  progress: {
    current: number
    total: number
    percentage: number
    completed: number
    remaining: number
  }
}

export class OnboardingWizardFramework<TData = any> {
  private config: WizardConfig<TData>
  private state: WizardState<TData>
  private listeners: Set<(state: WizardState<TData>) => void> = new Set()

  constructor(config: WizardConfig<TData>) {
    this.config = config
    this.state = this.initializeState()
    
    // Load persisted state if enabled
    if (config.persistState && config.storageKey) {
      this.loadPersistedState()
    }
  }

  private initializeState(): WizardState<TData> {
    return {
      currentStep: 0,
      data: { ...this.config.initialData },
      isProcessing: false,
      errors: [],
      completedSteps: new Set(),
      skippedSteps: new Set()
    }
  }

  private loadPersistedState(): void {
    try {
      const stored = localStorage.getItem(this.config.storageKey!)
      if (stored) {
        const persistedState = JSON.parse(stored)
        this.state = {
          ...this.state,
          ...persistedState,
          completedSteps: new Set(persistedState.completedSteps || []),
          skippedSteps: new Set(persistedState.skippedSteps || [])
        }
      }
    } catch (error) {
      console.warn('Failed to load persisted wizard state:', error)
    }
  }

  private persistState(): void {
    if (!this.config.persistState || !this.config.storageKey) return
    
    try {
      const stateToPersist = {
        ...this.state,
        completedSteps: Array.from(this.state.completedSteps),
        skippedSteps: Array.from(this.state.skippedSteps)
      }
      localStorage.setItem(this.config.storageKey, JSON.stringify(stateToPersist))
    } catch (error) {
      console.warn('Failed to persist wizard state:', error)
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state))
    this.persistState()
  }

  private async executeStepHook(
    hook: ((data: TData) => Promise<void> | void) | undefined,
    data: TData
  ): Promise<void> {
    if (!hook) return
    
    try {
      await hook(data)
    } catch (error) {
      console.error('Step hook execution failed:', error)
      throw error
    }
  }

  public subscribe(listener: (state: WizardState<TData>) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  public getState(): WizardState<TData> {
    return { ...this.state }
  }

  public getCurrentStep(): WizardStep<TData> {
    return this.config.steps[this.state.currentStep]
  }

  public getProgress() {
    const current = this.state.currentStep + 1
    const total = this.config.steps.length
    const completed = this.state.completedSteps.size
    
    return {
      current,
      total,
      percentage: Math.round((current / total) * 100),
      completed,
      remaining: total - current
    }
  }

  public async updateData(updates: Partial<TData>): Promise<void> {
    this.state = {
      ...this.state,
      data: { ...this.state.data, ...updates },
      errors: [] // Clear errors when data is updated
    }
    this.notifyListeners()
  }

  public setProcessing(processing: boolean): void {
    this.state = { ...this.state, isProcessing: processing }
    this.notifyListeners()
  }

  public async nextStep(): Promise<void> {
    const currentStep = this.getCurrentStep()
    const validation = currentStep.validation(this.state.data)
    
    if (!validation.isValid) {
      this.state = { ...this.state, errors: validation.errors }
      this.notifyListeners()
      return
    }

    // Execute onExit hook for current step
    await this.executeStepHook(currentStep.onExit, this.state.data)

    // Mark current step as completed
    this.state.completedSteps.add(this.state.currentStep)

    if (this.state.currentStep < this.config.steps.length - 1) {
      this.state = {
        ...this.state,
        currentStep: this.state.currentStep + 1,
        errors: []
      }

      // Execute onEnter hook for new step
      const newStep = this.getCurrentStep()
      await this.executeStepHook(newStep.onEnter, this.state.data)
    } else {
      // Wizard complete
      await this.complete()
    }

    this.notifyListeners()
  }

  public async prevStep(): Promise<void> {
    if (this.state.currentStep > 0) {
      const currentStep = this.getCurrentStep()
      
      // Execute onExit hook for current step
      await this.executeStepHook(currentStep.onExit, this.state.data)

      this.state = {
        ...this.state,
        currentStep: this.state.currentStep - 1,
        errors: []
      }

      // Execute onEnter hook for previous step
      const newStep = this.getCurrentStep()
      await this.executeStepHook(newStep.onEnter, this.state.data)

      this.notifyListeners()
    }
  }

  public async goToStep(stepIndex: number): Promise<void> {
    if (stepIndex < 0 || stepIndex >= this.config.steps.length) {
      throw new Error(`Invalid step index: ${stepIndex}`)
    }

    const currentStep = this.getCurrentStep()
    
    // Execute onExit hook for current step
    await this.executeStepHook(currentStep.onExit, this.state.data)

    this.state = {
      ...this.state,
      currentStep: stepIndex,
      errors: []
    }

    // Execute onEnter hook for new step
    const newStep = this.getCurrentStep()
    await this.executeStepHook(newStep.onEnter, this.state.data)

    this.notifyListeners()
  }

  public async skipStep(): Promise<void> {
    const currentStep = this.getCurrentStep()
    
    if (!this.config.allowSkipping && !currentStep.canSkip) {
      throw new Error('Step cannot be skipped')
    }

    // Execute onExit hook for current step
    await this.executeStepHook(currentStep.onExit, this.state.data)

    // Mark current step as skipped
    this.state.skippedSteps.add(this.state.currentStep)

    if (this.state.currentStep < this.config.steps.length - 1) {
      this.state = {
        ...this.state,
        currentStep: this.state.currentStep + 1,
        errors: []
      }

      // Execute onEnter hook for new step
      const newStep = this.getCurrentStep()
      await this.executeStepHook(newStep.onEnter, this.state.data)
    } else {
      // Wizard complete
      await this.complete()
    }

    this.notifyListeners()
  }

  public reset(): void {
    this.state = this.initializeState()
    
    // Clear persisted state
    if (this.config.persistState && this.config.storageKey) {
      localStorage.removeItem(this.config.storageKey)
    }
    
    this.notifyListeners()
  }

  public async complete(): Promise<void> {
    try {
      if (this.config.onComplete) {
        await this.config.onComplete(this.state.data)
      }
      
      // Clear persisted state on completion
      if (this.config.persistState && this.config.storageKey) {
        localStorage.removeItem(this.config.storageKey)
      }
    } catch (error) {
      console.error('Wizard completion failed:', error)
      throw error
    }
  }

  public async cancel(): Promise<void> {
    try {
      if (this.config.onCancel) {
        await this.config.onCancel(this.state.data)
      }
      
      // Clear persisted state on cancellation
      if (this.config.persistState && this.config.storageKey) {
        localStorage.removeItem(this.config.storageKey)
      }
    } catch (error) {
      console.error('Wizard cancellation failed:', error)
      throw error
    }
  }

  public getActions(): WizardActions<TData> {
    return {
      nextStep: () => this.nextStep(),
      prevStep: () => this.prevStep(),
      goToStep: (stepIndex: number) => this.goToStep(stepIndex),
      skipStep: () => this.skipStep(),
      updateData: (updates: Partial<TData>) => this.updateData(updates),
      setProcessing: (processing: boolean) => this.setProcessing(processing),
      reset: () => this.reset(),
      complete: () => this.complete(),
      cancel: () => this.cancel()
    }
  }

  public createHook(): () => WizardHookReturn<TData> {
    return () => {
      const [, forceUpdate] = React.useReducer(x => x + 1, 0)
      
      React.useEffect(() => {
        const unsubscribe = this.subscribe(() => forceUpdate())
        return unsubscribe
      }, [])

      return {
        state: this.getState(),
        actions: this.getActions(),
        currentStep: this.getCurrentStep(),
        progress: this.getProgress()
      }
    }
  }
}

// Utility functions for common validation patterns
export const ValidationHelpers = {
  required: (value: any, fieldName: string): string | null => {
    if (value === null || value === undefined || value === '') {
      return `${fieldName} is required`
    }
    return null
  },

  minLength: (value: string, minLength: number, fieldName: string): string | null => {
    if (typeof value === 'string' && value.length < minLength) {
      return `${fieldName} must be at least ${minLength} characters`
    }
    return null
  },

  maxLength: (value: string, maxLength: number, fieldName: string): string | null => {
    if (typeof value === 'string' && value.length > maxLength) {
      return `${fieldName} must be no more than ${maxLength} characters`
    }
    return null
  },

  minItems: (items: any[], minItems: number, fieldName: string): string | null => {
    if (Array.isArray(items) && items.length < minItems) {
      return `${fieldName} must have at least ${minItems} items`
    }
    return null
  },

  maxItems: (items: any[], maxItems: number, fieldName: string): string | null => {
    if (Array.isArray(items) && items.length > maxItems) {
      return `${fieldName} must have no more than ${maxItems} items`
    }
    return null
  },

  email: (value: string, fieldName: string): string | null => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (typeof value === 'string' && !emailRegex.test(value)) {
      return `${fieldName} must be a valid email address`
    }
    return null
  },

  url: (value: string, fieldName: string): string | null => {
    try {
      new URL(value)
      return null
    } catch {
      return `${fieldName} must be a valid URL`
    }
  },

  combine: (...validators: Array<() => string | null>): string[] => {
    return validators
      .map(validator => validator())
      .filter((error): error is string => error !== null)
  }
}

// React Hook for using the wizard framework
export function useOnboardingWizard<TData = any>(
  config: WizardConfig<TData>
): WizardHookReturn<TData> {
  const [wizard] = React.useState(() => new OnboardingWizardFramework(config))
  return wizard.createHook()()
}

// Higher-order component for wizard steps
export function withWizardStep<TData = any, TProps = {}>(
  Component: React.ComponentType<TProps & WizardStepProps<TData>>
) {
  return (props: TProps & WizardStepProps<TData>) => {
    return React.createElement(Component, props)
  }
}

// Default step validation that always passes
export const defaultStepValidation = <TData = any>(): { isValid: boolean; errors: string[] } => ({
  isValid: true,
  errors: []
})

// Export types for external use
export type {
  WizardStep,
  WizardStepProps,
  WizardState,
  WizardConfig,
  WizardActions,
  WizardHookReturn
}