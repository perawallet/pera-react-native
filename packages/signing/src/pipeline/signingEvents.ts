/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import type { SignRequest } from '../models'
import type { ResolvedSignerType } from '../machine/context'
import type { SignableAnalysis, TransportResult } from './types'

/** Snapshot of hardware-signing sub-flow, surfaced as part of lifecycle events. */
export type HardwarePhaseSnapshot = {
    status: 'idle' | 'searching' | 'awaiting_approval' | 'signing' | 'error'
    deviceName: string | null
    currentTx: number
    totalTxs: number
    error: { kind: string; cause: unknown } | null
}

/** Snapshot of multisig sub-flow, surfaced as part of lifecycle events. */
export type MultisigPhaseSnapshot = {
    mode: 'proposing' | 'cosigning'
    currentParticipant: string | null
    participantsRemaining: number
    signaturesCollected: number
    thresholdReached: boolean
}

export type SigningLifecycleEvent =
    | { type: 'started'; request: SignRequest }
    | {
          type: 'analysis-ready'
          request: SignRequest
          analyses: SignableAnalysis[]
      }
    | { type: 'awaiting-user'; request: SignRequest }
    | {
          type: 'signing-started'
          request: SignRequest
          signerType: ResolvedSignerType
      }
    | {
          type: 'hardware-phase'
          request: SignRequest
          phase: HardwarePhaseSnapshot
      }
    | {
          type: 'multisig-phase'
          request: SignRequest
          phase: MultisigPhaseSnapshot
      }
    | {
          type: 'transport-result'
          request: SignRequest
          result: TransportResult
      }
    | { type: 'completed'; request: SignRequest; result: TransportResult }
    | { type: 'failed'; request: SignRequest; error: Error }
    | { type: 'rejected'; request: SignRequest }
