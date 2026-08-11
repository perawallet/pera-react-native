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

import {
    AppError,
    ErrorCategory,
    type ErrorMetadata,
    ErrorSeverity,
} from '@perawallet/wallet-core-shared'

/**
 * Base pipeline error
 */
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

/**
 * User cancelled the operation
 */
export class UserCancelledError extends PipelineError {
    constructor() {
        super('User cancelled the operation', undefined, {
            severity: ErrorSeverity.LOW,
            retryable: false,
        })
    }
}

/**
 * Cannot sign with the given account
 */
export class CannotSignError extends PipelineError {
    constructor(address: string, reason?: string) {
        super(
            reason
                ? `Cannot sign with account ${address}: ${reason}`
                : `Cannot sign with account ${address}`,
            undefined,
            {
                params: { address, reason },
            },
        )
    }
}

/**
 * No local participants found for multisig account
 */
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

/**
 * Source failed to provide signable data
 */
export class SourceError extends PipelineError {
    constructor(message: string, originalError?: Error) {
        super(`Failed to get signable data: ${message}`, originalError, {
            retryable: true,
        })
    }
}

/**
 * Analysis failed
 */
export class AnalysisError extends PipelineError {
    constructor(message: string, originalError?: Error) {
        super(`Analysis failed: ${message}`, originalError, {
            retryable: true,
        })
    }
}

/**
 * Signing failed
 */
export class SigningError extends PipelineError {
    constructor(
        message: string,
        originalError?: Error,
        options?: { retryable?: boolean },
    ) {
        super(`Signing failed: ${message}`, originalError, {
            retryable: options?.retryable ?? true,
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
 * Transport failed to deliver signed data
 */
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

/**
 * Hardware wallet connection error
 */
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

/**
 * Invalid signable data
 */
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

/**
 * A fee-adjusted ARC-0001 response (fees raised to a required minimum — see
 * `assignMinimumFeesToGroup`; today's only rule is the post-quantum minimum
 * for quantum signers) failed to deliver: the transport's
 * `respondWithResult` rejected. Distinguishes "this dApp may not support
 * the adjusted fees" from an ordinary transport failure so the UI can show
 * a targeted message instead of the raw delivery error. Extends
 * `TransportError` (rather than wrapping it) so its `retryable` semantics —
 * WC delivery retry — are unchanged.
 *
 * NOTE: for WalletConnect, the `respondWithError` callback rebuilds a fresh
 * `WalletConnectSignRequestError` from only the thrown error's `.message`
 * before it reaches `connectionError`
 * (packages/walletconnect/src/hooks/useWalletConnectHandlers.ts) — `.name`
 * does not survive that hop. `FEE_ADJUSTMENT_DELIVERY_MESSAGE_MARKER` is a
 * substring of every message this error is constructed with, so consumers
 * reading `connectionError` after that rewrap can still recognize it by
 * matching the message; `.name` remains the correct check for callers that
 * see the error directly.
 */
export const FEE_ADJUSTMENT_DELIVERY_MESSAGE_MARKER = 'fee-adjusted'

export class FeeAdjustmentDeliveryError extends TransportError {
    constructor(message: string, options?: { cause?: Error }) {
        super(message, options?.cause)
    }
}

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
