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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    AppError,
    ErrorCategory,
    type ErrorMetadata,
    ErrorSeverity,
} from '@perawallet/wallet-core-shared'
import type { WalletAccount } from './models'

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
    constructor(authAddress: string) {
        super(
            `Rekey target account ${authAddress} not found in local accounts`,
            undefined,
            {
                params: { authAddress },
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
    // Names the existing account by id, not its user-chosen name: the message
    // reaches crash reports.
    constructor(address: string, existingAccount?: Pick<WalletAccount, 'id'>) {
        super(
            existingAccount
                ? `Account with address ${address} is already in the wallet as ${existingAccount.id}`
                : `Account with address ${address} is already in the wallet`,
            undefined,
            {
                params: existingAccount
                    ? { address, existingAccountId: existingAccount.id }
                    : { address },
            },
        )
    }
}

/**
 * Why a BIP44 path failed validation.
 *
 * - `'malformed'`: the path string isn't a well-formed BIP44 path for the chain.
 * - `'mismatch'`: the path parses cleanly but points to a different
 *   account/change/keyIndex than the HDWalletDetails being compared against.
 */
export type Bip44PathFailureReason = 'malformed' | 'mismatch'

/**
 * Thrown when a chain's `assertHdPathMatches` rejects a path. Carries a
 * machine-readable `reason` so callers can map to domain-specific errors
 * (e.g. ARC-60's `ERROR_FAILED_HD_PATH`) without re-parsing the message.
 */
export class InvalidBip44PathError extends AccountError {
    readonly reason: Bip44PathFailureReason
    readonly hdPath: string

    constructor(
        hdPath: string,
        reason: Bip44PathFailureReason,
        detail: string,
    ) {
        super(`Invalid BIP44 path "${hdPath}": ${detail}`, undefined, {
            params: { hdPath, reason, detail },
        })
        this.reason = reason
        this.hdPath = hdPath
    }
}

class ChainFeatureUnsupportedError extends AccountError {
    readonly chainId: ChainId

    constructor(feature: string, chainId: ChainId) {
        super(`${feature} is not supported on ${chainId}`, undefined, {
            params: { chainId },
        })
        this.chainId = chainId
    }
}

export class RekeyUnsupportedError extends ChainFeatureUnsupportedError {
    constructor(chainId: ChainId) {
        super('Rekey', chainId)
    }
}

export class QuantumAccountsUnsupportedError extends ChainFeatureUnsupportedError {
    constructor(chainId: ChainId) {
        super('Post-quantum accounts', chainId)
    }
}

export class SingleKeyAccountsUnsupportedError extends ChainFeatureUnsupportedError {
    constructor(chainId: ChainId) {
        super('Single-key accounts', chainId)
    }
}

export class HdDerivationTypeUnsupportedError extends ChainFeatureUnsupportedError {
    constructor(derivationType: number, chainId: ChainId) {
        super(`HD derivation type ${derivationType}`, chainId)
    }
}
