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

import {
    AppError,
    ErrorCategory,
    ErrorMetadata,
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
 * Rekey target account not found in local accounts
 */
export class RekeyTargetNotFoundError extends PipelineError {
    constructor(rekeyAddress: string) {
        super(
            `Rekey target account ${rekeyAddress} not found in local accounts`,
            undefined,
            {
                params: { rekeyAddress },
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
    constructor(message: string, originalError?: Error) {
        super(`Signing failed: ${message}`, originalError, {
            retryable: true,
        })
    }
}

/**
 * Transport failed to deliver signed data
 */
export class TransportError extends PipelineError {
    constructor(message: string, originalError?: Error) {
        super(`Transport failed: ${message}`, originalError, {
            retryable: true,
        })
    }
}

/**
 * Hardware wallet connection error
 */
export class HardwareWalletError extends PipelineError {
    constructor(message: string, originalError?: Error) {
        super(`Hardware wallet error: ${message}`, originalError, {
            retryable: true,
        })
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
