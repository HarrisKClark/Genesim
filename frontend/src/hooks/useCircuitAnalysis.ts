import { useState, useEffect, useMemo } from 'react'
import { CircuitComponent } from '../types/dnaTypes'
import { CircuitModel, Operon, ValidationResult } from '../models/CircuitModel'

interface UseCircuitAnalysisProps {
  components: CircuitComponent[]
  dnaLength: number
  enabled?: boolean
}

interface UseCircuitAnalysisReturn {
  operons: Operon[]
  selectedOperonId: string | null
  setSelectedOperonId: (id: string | null) => void
  showHighlights: boolean
  setShowHighlights: (show: boolean) => void
  validOperons: Operon[]
  invalidOperons: Operon[]
  validationResult: ValidationResult | null
  circuitModel: CircuitModel | null
}

/**
 * Hook to manage circuit analysis state
 * Automatically detects operons when components change
 */
export function useCircuitAnalysis({
  components,
  dnaLength,
  enabled = false,
}: UseCircuitAnalysisProps): UseCircuitAnalysisReturn {
  const [selectedOperonId, setSelectedOperonId] = useState<string | null>(null)
  const [showHighlights, setShowHighlights] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)

  // Create circuit model
  const circuitModel = useMemo(() => {
    if (!enabled) return null
    return new CircuitModel(components, dnaLength)
  }, [components, dnaLength, enabled])

  // Detect operons when circuit changes
  useEffect(() => {
    if (!enabled || !circuitModel) {
      setValidationResult(null)
      return
    }

    // Run validation (which includes operon detection)
    const result = circuitModel.validateCircuit()
    setValidationResult(result)

    // Clear selected operon if it no longer exists
    if (selectedOperonId) {
      const stillExists = result.operons.some(op => op.id === selectedOperonId)
      if (!stillExists) {
        setSelectedOperonId(null)
      }
    }
  }, [circuitModel, enabled, selectedOperonId])

  const operons = validationResult?.operons ?? []
  const validOperons = useMemo(() => operons.filter(op => op.isValid), [operons])
  const invalidOperons = useMemo(() => operons.filter(op => !op.isValid), [operons])

  return {
    operons,
    selectedOperonId,
    setSelectedOperonId,
    showHighlights,
    setShowHighlights,
    validOperons,
    invalidOperons,
    validationResult,
    circuitModel,
  }
}



