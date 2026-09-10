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

import type { AlgodError } from '@perawallet/wallet-core-blockchain'
import {
    AppError,
    ErrorCategory,
    type ErrorMetadata,
    ErrorSeverity,
} from '@perawallet/wallet-core-shared'

/**
 * Bodies live under `errors.signing` next to the existing title so the app
 * layer resolves both from one key family.
 */
export const SIGNING_ERROR_KEYS = {
    title: 'errors.signing.title',
    localKeyFailed: 'errors.signing.local_key_failed',
    cannotSign: 'errors.signing.cannot_sign',
} as const

export type SigningErrorOptions = {
    retryable?: boolean
    /**
     * i18n body key. Set by the local-key strategy from the cause (a KMS
     * error) or its own fallback; left unset by the hardware/multisig
     * paths, which keep the generic banner.
     */
    messageKey?: string
    params?: Record<string, unknown>
}

export class PipelineError extends AppError {
    constructor(
        message: string,
        originalError?: Error,
        metadata?: Partial<ErrorMetadata>,
    ) {
        super(
            message,
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.TRANSACTIONS,
                retryable: false,
                ...metadata,
            },
            originalError,
        )
    }
}

export class UserCancelledError extends PipelineError {
    constructor() {
        super('User cancelled the operation', undefined, {
            severity: ErrorSeverity.LOW,
            retryable: false,
        })
    }
}

export class CannotSignError extends PipelineError {
    constructor(address: string, reason?: string) {
        super(
            reason
                ? `Cannot sign with account ${address}: ${reason}`
                : `Cannot sign with account ${address}`,
            undefined,
            {
                messageKey: SIGNING_ERROR_KEYS.cannotSign,
                titleKey: SIGNING_ERROR_KEYS.title,
                params: { address, reason },
            },
        )
    }
}

export class NoLocalParticipantsError extends PipelineError {
    constructor(address: string) {
        super(
            `No local participants found for multisig account ${address}`,
            undefined,
            {
                params: { address },
            },
        )
    }
}

export class SourceError extends PipelineError {
    constructor(message: string, originalError?: Error) {
        super(`Failed to get signable data: ${message}`, originalError, {
            retryable: true,
        })
    }
}

export class AnalysisError extends PipelineError {
    constructor(message: string, originalError?: Error) {
        super(`Analysis failed: ${message}`, originalError, {
            retryable: true,
        })
    }
}

export class SigningError extends PipelineError {
    constructor(
        message: string,
        originalError?: Error,
        options?: SigningErrorOptions,
    ) {
        super(`Signing failed: ${message}`, originalError, {
            retryable: options?.retryable ?? true,
            ...(options?.messageKey
                ? {
                      messageKey: options.messageKey,
                      titleKey: SIGNING_ERROR_KEYS.title,
                      params: options.params,
                  }
                : {}),
        })
    }
}

/**
 * A hardware-signing session was aborted app-side (cancel, timeout, machine
 * stop) while a device exchange was pending or queued. Only ever thrown
 * after the driving actor has been stopped, so it never surfaces to the
 * user — its role is to unwind the strategy's per-transaction loop so no
 * further APDUs reach the device.
 */
export class HardwareSigningAbortedError extends PipelineError {
    constructor() {
        super('Hardware signing aborted', undefined, {
            severity: ErrorSeverity.LOW,
            retryable: false,
        })
    }
}

/**
 * How a failed broadcast relates to chain state:
 *
 * - `rejected-by-node` — the node answered and refused the transaction. It is
 *   definitively not on chain; safe to report as a failure.
 * - `unknown-outcome` — the submit call failed without a node verdict
 *   (timeout, lost response, connection reset). The transaction may still be
 *   in the pool and confirm; callers must verify against the chain before
 *   reporting failure. Retrying the same bytes is safe — the node dedupes.
 *
 * "Already in ledger" never reaches this type: it is resolved as success at
 * the submit boundary.
 */
export type SubmissionErrorClassification =
    | 'rejected-by-node'
    | 'unknown-outcome'

/**
 * A broadcast failure that keeps the evidence needed to be honest about it:
 * the locally derived txIds (computable before the POST) and the structured
 * algod error. `retryable` is false only for `rejected-by-node` — resending
 * identical bytes a node already refused cannot succeed.
 */
export class SubmissionError extends PipelineError {
    readonly txIds: string[]
    readonly classification: SubmissionErrorClassification
    readonly algodError: AlgodError

    constructor(
        txIds: string[],
        classification: SubmissionErrorClassification,
        algodError: AlgodError,
    ) {
        super(
            `Submission ${classification}: ${algodError.message}`,
            algodError,
            {
                retryable: classification !== 'rejected-by-node',
                params: { txIds, classification, code: algodError.code },
            },
        )
        this.txIds = txIds
        this.classification = classification
        this.algodError = algodError
    }
}

export class TransportError extends PipelineError {
    constructor(
        message: string,
        originalError?: Error,
        options?: { retryable?: boolean },
    ) {
        super(`Transport failed: ${message}`, originalError, {
            retryable: options?.retryable ?? true,
        })
    }
}

export type HardwareWalletErrorReason =
    | 'unsupported_data_type'
    | 'transport_unavailable'
    | 'signer_not_found'
    | 'registry_required'

export class HardwareWalletError extends PipelineError {
    readonly reason: HardwareWalletErrorReason

    constructor(reason: HardwareWalletErrorReason, originalError?: Error) {
        super(`Hardware wallet error: ${reason}`, originalError, {
            // Retrying an unsupported operation can never succeed; the other
            // reasons are transient (transport/registry/signer lookup).
            retryable: reason !== 'unsupported_data_type',
            params: { reason },
        })
        this.reason = reason
    }
}

export class InvalidSignableDataError extends PipelineError {
    constructor(reason: string) {
        super(`Invalid signable data: ${reason}`, undefined, {
            params: { reason },
        })
    }
}

/**
 * Decoded transactions do not round-trip to the original raw bytes.
 * Indicates a decoder bug silently dropped or mutated a field — the
 * analysis shown to the user would not match the bytes being signed.
 */
export class TransactionRoundTripError extends PipelineError {
    constructor(reason: string) {
        super(
            `Transaction round-trip validation failed: ${reason}`,
            undefined,
            {
                params: { reason },
            },
        )
    }
}

// WalletConnect's rejection path rewraps the error keeping only `.message`, so
// every FeeAdjustmentDeliveryError message contains this marker.
export const FEE_ADJUSTMENT_DELIVERY_MESSAGE_MARKER = 'fee-adjusted'

/**
 * A fee-adjusted ARC-0001 response (`assignMinimumFeesToGroup`) failed to
 * deliver: "this dApp may not support the adjusted fees" rather than an ordinary
 * transport failure. Extends `TransportError` so `retryable` is unchanged.
 */
export class FeeAdjustmentDeliveryError extends TransportError {
    constructor(message: string, options?: { cause?: Error }) {
        super(message, options?.cause)
    }
}

// `.name` for callers that see the error directly; the marker after the WalletConnect rewrap.
export const isFeeAdjustmentDeliveryError = (error: Error): boolean =>
    error.name === FeeAdjustmentDeliveryError.name ||
    error.message.includes(FEE_ADJUSTMENT_DELIVERY_MESSAGE_MARKER)

/**
 * The active network changed between actor creation and submission.
 * Aborts rather than submitting signed bytes to the wrong chain.
 */
export class NetworkChangedError extends PipelineError {
    constructor(expected: string, actual: string) {
        super(
            `Network changed during signing: expected ${expected} but active network is ${actual}`,
            undefined,
            { params: { expected, actual } },
        )
    }
}

/**
 * A transaction's genesisHash does not match the active network. Treated as
 * exceptional/malicious (e.g. mainnet-genesis bytes delivered over a testnet
 * session) — aborts signing entirely rather than producing a cross-chain
 * signature. Non-retryable: retrying cannot change the bytes.
 */
export class GenesisHashMismatchError extends PipelineError {
    constructor(
        network: string,
        index: number,
        expected: string,
        actual: string,
    ) {
        super(
            `One or more of the transactions target a different Algorand network than the active one (${network}).`,
            undefined,
            { params: { network, index, expected, actual } },
        )
    }
}
