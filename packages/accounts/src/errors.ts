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
 * Base account error
 */
export class AccountError extends AppError {
    constructor(
        message: string,
        originalError?: Error,
        metadata?: Partial<ErrorMetadata>,
    ) {
        super(
            message,
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.ACCOUNTS,
                retryable: false,
                messageKey: 'errors.account.generic',
                ...metadata,
            },
            originalError,
        )
    }
}

/**
 * Account has no HD wallet details
 */
export class NoHDWalletError extends AccountError {
    constructor(walletKeyId: string) {
        super('No Universal Wallet could be found', undefined, {
            messageKey: 'errors.account.no_hd_wallet',
            params: { walletKeyId },
        })
    }
}

/**
 * Rekey target account not found in local accounts
 */
export class RekeyTargetNotFoundError extends AccountError {
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
 * No pending HD import session matches the given walletKeyId
 */
export class HDImportSessionNotFoundError extends AccountError {
    constructor(walletKeyId: string) {
        super(
            `No pending HD import session for walletKeyId=${walletKeyId}`,
            undefined,
            {
                params: { walletKeyId },
            },
        )
    }
}

/**
 * The address derived from the import flow already exists in the wallet.
 *
 * Surfaced from the algo25 import path so the UI can show a specific
 * "already imported" toast instead of the generic failure message. HD
 * imports get the same protection at the selection screen (already-
 * imported addresses render a chip rather than a checkbox).
 */
export class DuplicateAccountError extends AccountError {
    constructor(address: string) {
        super(
            `Account with address ${address} is already in the wallet`,
            undefined,
            { params: { address } },
        )
    }
}
