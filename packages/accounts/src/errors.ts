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

import { type ChainId, i18nKey } from '@perawallet/wallet-core-chain-contract'
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
                messageKey: i18nKey('errors.account.generic'),
                ...metadata,
            },
            originalError,
        )
    }
}

/**
 * The wallet holds no HD seed under the id given.
 */
export class NoHdSeedError extends AccountError {
    constructor(walletKeyId: string) {
        super('No Universal Wallet could be found', undefined, {
            messageKey: i18nKey('errors.account.no_hd_wallet'),
            params: { walletKeyId },
        })
    }
}

/**
 * The wallet has no seed that can mint an account on the chain.
 */
export class WalletCannotDeriveError extends AccountError {
    readonly walletId: string
    readonly chainId: ChainId

    constructor(walletId: string, chainId: ChainId) {
        super(
            `Wallet ${walletId} cannot derive an account on ${chainId}`,
            undefined,
            { params: { walletId, chainId } },
        )
        this.walletId = walletId
        this.chainId = chainId
    }
}

export class InvalidChainAddressError extends AccountError {
    constructor(chainId: ChainId) {
        super(`Not an address on ${chainId}`, undefined, {
            params: { chainId },
        })
    }
}

export class AccountNotFoundError extends AccountError {
    constructor(accountId: string) {
        super(`No account ${accountId} in the wallet`, undefined, {
            params: { accountId },
        })
    }
}

/**
 * The account's custody can't produce an address on the chain, so the chain
 * can't be enabled on it.
 */
export class ChainNotEligibleError extends AccountError {
    readonly accountId: string
    readonly chainId: ChainId

    constructor(accountId: string, chainId: ChainId) {
        super(
            `Account ${accountId} is not eligible for ${chainId}`,
            undefined,
            { params: { accountId, chainId } },
        )
        this.accountId = accountId
        this.chainId = chainId
    }
}

/**
 * A hardware account's address on a new chain comes from its device; the
 * caller has to read it there first.
 */
export class DeviceAddressRequiredError extends AccountError {
    constructor(chainId: ChainId) {
        super(`Enabling ${chainId} needs the device's address`, undefined, {
            params: { chainId },
        })
    }
}

/**
 * Delegation target account not found in local accounts
 */
export class DelegationTargetNotFoundError extends AccountError {
    constructor(authorityAddress: string) {
        super(
            `Delegation target account ${authorityAddress} not found in local accounts`,
            undefined,
            {
                params: { authorityAddress },
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
 * Surfaced from the single-key import path so the UI can show a specific
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
 * The address a key or derivation path produced isn't the one the caller
 * holds for it, so the source (e.g. a backup) is corrupt or mismatched.
 */
export class AddressMismatchError extends AccountError {
    constructor(expected: string, derived: string) {
        super(
            `Derived address ${derived} does not match expected ${expected}`,
            undefined,
            { params: { expected, derived } },
        )
    }
}

/**
 * Why a BIP44 path failed validation.
 *
 * - `'malformed'`: the path string isn't a well-formed BIP44 path for the chain.
 * - `'mismatch'`: the path parses cleanly but points to a different
 *   account/change/keyIndex than the HD index being compared against.
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

export class RawKeyImportUnsupportedError extends ChainFeatureUnsupportedError {
    constructor(chainId: ChainId) {
        super('Private-key import', chainId)
    }
}

export class SingleKeyAccountsUnsupportedError extends ChainFeatureUnsupportedError {
    constructor(chainId: ChainId) {
        super('Single-key accounts', chainId)
    }
}

export class HdAccountsUnsupportedError extends ChainFeatureUnsupportedError {
    constructor(chainId: ChainId) {
        super('HD accounts', chainId)
    }
}

export class MultisigUnsupportedError extends ChainFeatureUnsupportedError {
    constructor(chainId: ChainId) {
        super('Multisig accounts', chainId)
    }
}

export class RootKeyDiscoveryUnsupportedError extends ChainFeatureUnsupportedError {
    constructor(chainId: ChainId) {
        super('Discovery from an in-memory root key', chainId)
    }
}

export class PrivateKeyCodecUnsupportedError extends ChainFeatureUnsupportedError {
    constructor(chainId: ChainId) {
        super('Private-key encoding', chainId)
    }
}

export class PrivateKeyRevealUnsupportedError extends AccountError {
    readonly accountId: string

    constructor(accountId: string) {
        super('This account has no private key to reveal', undefined, {
            params: { accountId },
        })
        this.accountId = accountId
    }
}

/** Neither Pera nor the chain gave a token's details, so it can't be added. */
export class TokenMetadataUnavailableError extends AccountError {
    constructor(assetId: string) {
        super('No metadata could be stored for the token', undefined, {
            messageKey: i18nKey('errors.account.token_unreadable'),
            params: { assetId },
        })
    }
}
