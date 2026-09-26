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

import type { Decimal } from 'decimal.js'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { TransactionSignRequest } from '@perawallet/wallet-core-signing'
import type { Network, Nullable } from '@perawallet/wallet-core-shared'
import type {
    PrepareTransactionsRequest,
    SwapStatusUpdateRequest,
} from '../api'
import type {
    PrepareTransactionsResult,
    SwapHandoffRecord,
    SwapQuote,
} from '../models'

/** The in-flight phases an execution reports through `onProgress`. */
export type SwapExecutionProgress =
    | 'preparing'
    | 'signing'
    | 'submitting'
    | 'updating-status'

/**
 * Why an execution failed. Carries data, not copy: the display layer owns
 * the wording, so a raw `error` is kept only where it classifies itself
 * (backend 4xx, offline, unknown-outcome submission).
 */
export type SwapExecutionFailure =
    | { phase: 'prepare'; reason: 'missing-quote-id' }
    | { phase: 'prepare'; reason: 'asset-frozen'; assetId: string }
    | {
          phase: 'prepare'
          reason: 'insufficient-native-balance'
          /** Shortfall in base units of the native asset. */
          shortfall: Decimal
      }
    | { phase: 'prepare'; reason: 'prepare-failed'; error: unknown }
    | { phase: 'prepare'; reason: 'no-transaction-groups' }
    | { phase: 'prepare'; reason: 'quote-mismatch' }
    | { phase: 'signing'; reason: 'quantum-blocked'; translationKey: string }
    | { phase: 'signing'; reason: 'signing-failed' }
    | { phase: 'submission'; reason: 'submission-failed'; error: unknown }

export type ExecuteSwapResult =
    | { kind: 'success'; txIds: string[] }
    // Abandoned through `isCancelled` before anything was signed.
    | { kind: 'cancelled' }
    // The user declined the signing request (on screen or on a Ledger).
    | { kind: 'user-rejected' }
    // Shared-account swap proposed; the cosign resolver submits it later.
    | { kind: 'pending-cosign' }
    // The quote outlived its client TTL — never executed; the caller re-quotes.
    | { kind: 'stale-quote' }
    // An earlier attempt for this sender is still open — nothing was signed or
    // broadcast.
    | { kind: 'verifying-previous' }
    | { kind: 'failed'; failure: SwapExecutionFailure }

export type ExecuteSwapParams = {
    quote: SwapQuote
    /** The selected account; the frozen and balance preflights need one. */
    account: Nullable<WalletAccount>
    /**
     * The resolved effective signer (`useSignerFor`), not the account's own
     * nominal type: an account rekeyed to a quantum auth account signs with
     * Falcon even though its own `type` is not `'quantum'`.
     */
    signer: Nullable<WalletAccount>
    /** `enable_quantum_swap` remote flag; gates quantum signers out of swaps. */
    isQuantumSwapEnabled: boolean
    /** Localized source metadata shown on the signing request. */
    signingSource: { name: string; description: string }
    onProgress: (progress: SwapExecutionProgress) => void
    /** Polled at the cancellable checkpoints, all before signing starts. */
    isCancelled: () => boolean
}

export type UpdateSwapStatusFn = (params: {
    swapId: string
    data: SwapStatusUpdateRequest
}) => Promise<unknown>

/** The chain-neutral collaborators an execution needs from the app. */
export type SwapExecutionContext = {
    network: Network
    /**
     * Extra balance an account must hold to receive an asset it does not hold
     * yet, in base units of the native asset.
     */
    assetOptInMinBalance: bigint
    deviceId: Nullable<string>
    addSignRequest: (request: TransactionSignRequest) => void
    prepareTransactions: (
        request: PrepareTransactionsRequest,
    ) => Promise<PrepareTransactionsResult>
    updateSwapStatus: UpdateSwapStatusFn
    registerHandoff: (record: SwapHandoffRecord) => void
}
