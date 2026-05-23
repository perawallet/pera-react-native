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

export type HardwareSigningInput = {
    groups: AnalyzedSignableGroup[]
    allAccounts: WalletAccount[]
    hardwareWalletRegistry: HardwareWalletRegistry
    encodeTransaction: EncodeTransactionFunction
    /** Total transactions across all groups — set by parent for initial currentTx/totalTxs. */
    totalTxs: number
    /** Device name resolved at parent build-time so the overlay can render immediately. */
    deviceName: Nullable<string>
}

export type HardwareSigningContext = HardwareSigningInput & {
    currentTx: number
    error: Nullable<HardwareErrorPayload>
    results: SigningResult[]
}

export type HardwareSigningEvent =
    | { type: 'CONNECTING' }
    | { type: 'AWAITING_APPROVAL' }
    | { type: 'SIGNING_STARTED' }
    | { type: 'PROGRESS'; current: number; total: number }
    | { type: 'GROUP_SIGNED'; result: SigningResult }
    | { type: 'STRATEGY_ERROR'; error: HardwareErrorPayload }
    | { type: 'ALL_DONE' }
    | { type: 'USER_REJECTED_ON_DEVICE' }
    | { type: 'RETRY' }
    | { type: 'ACKNOWLEDGE_ERROR' }

export type HardwareSigningOutput =
    | { kind: 'success'; results: SigningResult[] }
    | { kind: 'rejected' }
    | { kind: 'error'; error: HardwareErrorPayload }
