/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { HardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { AnalyzedSignableGroup, SigningResult } from '../../pipeline/types'
import type { EncodeTransactionFunction } from '../../pipeline/signing/createHardwareStrategy'
import type { LedgerErrorPresetKind } from '../../types/ledgerErrorPresetKind'

export type HardwareErrorPayload = {
    kind: LedgerErrorPresetKind
    cause: unknown
}

/**
 * Discriminates whether the hardware-signing session is approving a
 * transaction group or a data-signing request (ARC-60 / arbitrary-data).
 * Drives the awaiting-approval overlay copy so the user sees context-aware
 * instructions rather than generic transaction language.
 */
export type HardwareSigningOperation = 'transaction' | 'data'

export type HardwareSigningInput = {
    groups: AnalyzedSignableGroup[]
    allAccounts: WalletAccount[]
    hardwareWalletRegistry: HardwareWalletRegistry
    encodeTransaction: EncodeTransactionFunction
    /** Total transactions across all groups — set by parent for initial currentTx/totalTxs. */
    totalTxs: number
    /** Device name resolved at parent build-time so the overlay can render immediately. */
    deviceName: Nullable<string>
    /** 'transaction' for tx groups, 'data' for arc60/arbitrary-data. Drives overlay copy. */
    operation: HardwareSigningOperation
}

export type HardwareSigningContext = HardwareSigningInput & {
    currentTx: number
    error: Nullable<HardwareErrorPayload>
    results: SigningResult[]
}

export type HardwareSigningEvent =
    | { type: 'AWAITING_APPROVAL' }
    | { type: 'SIGNING_STARTED' }
    | { type: 'PROGRESS'; current: number; total: number }
    | { type: 'GROUP_SIGNED'; result: SigningResult }
    | { type: 'STRATEGY_ERROR'; error: HardwareErrorPayload }
    /**
     * Non-device errors (ARC-60 validation, generic JS errors). Surface as an
     * immediate failure rather than the BLE-class teardown carveout — the
     * troubleshooting sheet only makes sense for genuine connection problems.
     */
    | { type: 'NON_LEDGER_ERROR'; error: HardwareErrorPayload }
    | { type: 'ALL_DONE' }
    | { type: 'USER_REJECTED_ON_DEVICE' }
    | { type: 'RETRY' }
    | { type: 'ACKNOWLEDGE_ERROR' }

export type HardwareSigningOutput =
    | { kind: 'success'; results: SigningResult[] }
    | { kind: 'rejected' }
    | { kind: 'error'; error: HardwareErrorPayload }
