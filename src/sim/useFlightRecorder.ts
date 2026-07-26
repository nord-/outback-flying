import { useCallback, useEffect, useRef, useState } from 'react'
import { useSim } from './useSim'
import {
  initRecorderState,
  recordSample,
  closeFlight,
  recorderSnapshot,
  type RecorderState,
  type RecorderSnapshot,
  type DerivedFlight,
} from '../game/flightlog'

export type RecordingPhase = 'idle' | 'recording'

/**
 * Bridges the live SimConnect sample stream (useSim) into the pure recorder
 * reducer (game/flightlog.ts), for the UI. Folding one sample at a time here
 * is the same reducer a test folds over a whole array at once — the pure
 * logic doesn't know or care that the samples are arriving live.
 */
export function useFlightRecorder() {
  const { available, status, sample } = useSim()
  const [phase, setPhase] = useState<RecordingPhase>('idle')
  // No region matters until start(regionId) is called — this is overwritten
  // before any sample is ever recorded.
  const stateRef = useRef<RecorderState>(initRecorderState(''))
  const [snapshot, setSnapshot] = useState<RecorderSnapshot>(() => recorderSnapshot(stateRef.current))

  useEffect(() => {
    if (phase !== 'recording' || !sample) return
    stateRef.current = recordSample(stateRef.current, sample)
    setSnapshot(recorderSnapshot(stateRef.current))
  }, [sample, phase])

  const start = useCallback((regionId: string) => {
    stateRef.current = initRecorderState(regionId)
    setSnapshot(recorderSnapshot(stateRef.current))
    setPhase('recording')
  }, [])

  /** Finalise the recording. Returns null if nothing flyable was captured
   *  (see game/flightlog.ts closeFlight) — the caller should keep recording. */
  const finish = useCallback((): DerivedFlight | null => {
    const result = closeFlight(stateRef.current)
    if (result) setPhase('idle')
    return result
  }, [])

  const cancel = useCallback(() => {
    stateRef.current = initRecorderState('')
    setSnapshot(recorderSnapshot(stateRef.current))
    setPhase('idle')
  }, [])

  return {
    simAvailable: available,
    simStatus: status,
    sample,
    phase,
    snapshot,
    start,
    finish,
    cancel,
  }
}
