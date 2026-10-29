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
    type ErrorMessageKeys,
    toError,
} from '@perawallet/wallet-core-shared'
import {
    i18nKey,
    type ChainId,
    type TransactionIntent,
} from '@perawallet/wallet-core-chain-contract'

/**
 * Base blockchain error
 */
export class TransactionError extends AppError {
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
 * Transaction-related error
 */
export class InvalidSendParamsError extends TransactionError {
    constructor(params?: string[], originalError?: Error) {
        super('The transaction appears to be invalid', originalError, {
            params: {
                errorParams: params,
            },
        })
    }
}

export class UnsupportedTransactionIntentError extends TransactionError {
    constructor(kind: TransactionIntent['kind'], chainId: ChainId) {
        super(`${chainId} cannot build a ${kind} intent`)
        this.name = 'UnsupportedTransactionIntentError'
    }
}

const NOT_REPLACEABLE_KEYS: ErrorMessageKeys = {
    titleKey: i18nKey('errors.transaction.not_replaceable.title'),
    bodyKey: i18nKey('errors.transaction.not_replaceable.body'),
}

/** The transaction is no longer pending, or this wallet holds nothing it can re-price. */
export class TransactionNotReplaceableError extends TransactionError {
    constructor() {
        super('The transaction can no longer be replaced', undefined, {
            titleKey: NOT_REPLACEABLE_KEYS.titleKey,
            messageKey: NOT_REPLACEABLE_KEYS.bodyKey,
        })
        this.name = 'TransactionNotReplaceableError'
    }
}

const ALREADY_OPTED_IN_KEYS: ErrorMessageKeys = {
    titleKey: i18nKey('errors.transaction.already_opted_in.title'),
    bodyKey: i18nKey('errors.transaction.already_opted_in.body'),
}

export class AlreadyOptedInError extends TransactionError {
    constructor() {
        super('Account is already opted in to this asset', undefined, {
            titleKey: ALREADY_OPTED_IN_KEYS.titleKey,
            messageKey: ALREADY_OPTED_IN_KEYS.bodyKey,
        })
    }
}

const INSUFFICIENT_BALANCE_FOR_OPT_IN_KEYS: ErrorMessageKeys = {
    titleKey: i18nKey(
        'errors.transaction.insufficient_balance_for_opt_in.title',
    ),
    bodyKey: i18nKey('errors.transaction.insufficient_balance_for_opt_in.body'),
}

export class InsufficientBalanceForOptInError extends TransactionError {
    /**
     * @param shortfall ALGO (display units) still needed, already formatted
     *   for the active locale since the app layer interpolates it verbatim.
     */
    constructor(shortfall: string) {
        super(
            'Insufficient ALGO balance to opt in. Account needs enough to cover the minimum balance requirement and transaction fee.',
            undefined,
            {
                titleKey: INSUFFICIENT_BALANCE_FOR_OPT_IN_KEYS.titleKey,
                messageKey: INSUFFICIENT_BALANCE_FOR_OPT_IN_KEYS.bodyKey,
                params: { shortfall },
            },
        )
    }
}

const NON_ZERO_BALANCE_KEYS: ErrorMessageKeys = {
    titleKey: i18nKey('errors.transaction.non_zero_balance_opt_out.title'),
    bodyKey: i18nKey('errors.transaction.non_zero_balance_opt_out.body'),
}

export class NonZeroBalanceError extends TransactionError {
    constructor() {
        super(
            'Cannot opt out of an asset with a non-zero balance. Transfer the remaining balance first.',
            undefined,
            {
                titleKey: NON_ZERO_BALANCE_KEYS.titleKey,
                messageKey: NON_ZERO_BALANCE_KEYS.bodyKey,
            },
        )
    }
}

const CREATOR_CANNOT_OPT_OUT_KEYS: ErrorMessageKeys = {
    titleKey: i18nKey('errors.transaction.creator_cannot_opt_out.title'),
    bodyKey: i18nKey('errors.transaction.creator_cannot_opt_out.body'),
}

export class CreatorCannotOptOutError extends TransactionError {
    constructor() {
        super('Asset creators cannot opt out of their own assets.', undefined, {
            titleKey: CREATOR_CANNOT_OPT_OUT_KEYS.titleKey,
            messageKey: CREATOR_CANNOT_OPT_OUT_KEYS.bodyKey,
        })
    }
}

const ASSET_FROZEN_KEYS: ErrorMessageKeys = {
    titleKey: i18nKey('errors.transaction.asset_frozen.title'),
    bodyKey: i18nKey('errors.transaction.asset_frozen.body'),
}

export class AssetFrozenError extends TransactionError {
    constructor(assetId: string) {
        super("The sender's holding of this asset is frozen.", undefined, {
            titleKey: ASSET_FROZEN_KEYS.titleKey,
            messageKey: ASSET_FROZEN_KEYS.bodyKey,
            params: { assetId },
        })
    }
}

/**
 * The stage of a delegation flow that failed. Confirm screens map this to
 * failure-specific copy instead of a single generic "something went wrong".
 *
 *  - `user_rejected`     — source cancelled signing (Close on the Ledger
 *                          approval sheet, or rejected on device).
 *  - `build_failed`      — the unsigned delegation transaction could not be built.
 *  - `signing_failed`    — the signing pipeline errored (Ledger timeout,
 *                          transport failure, device error).
 *  - `submission_failed` — algod rejected or could not receive the signed
 *                          group (fee too low, network, node error).
 *  - `submission_pending` — an earlier attempt of the same delegation is still
 *                          open in the submission ledger; rebuilding now
 *                          would mint a new txid algod cannot dedupe.
 */
export type DelegationErrorReason =
    | 'user_rejected'
    | 'build_failed'
    | 'signing_failed'
    | 'submission_failed'
    | 'submission_pending'

/**
 * Typed error for every delegation failure. The {@link DelegationErrorReason} lets
 * callers branch on the failed stage; `originalError` preserves the raw
 * cause so it can still be routed through the algod error translator.
 *
 * The raw cause is accepted as `unknown` and normalized to an `Error` —
 * caught values are not guaranteed to be `Error` instances, and downstream
 * consumers rely on it being one.
 */
export class DelegationError extends AppError {
    readonly reason: DelegationErrorReason

    constructor(reason: DelegationErrorReason, originalError?: unknown) {
        super(
            `Delegation failed: ${reason}`,
            {
                severity:
                    reason === 'user_rejected'
                        ? ErrorSeverity.LOW
                        : ErrorSeverity.MEDIUM,
                category: ErrorCategory.TRANSACTIONS,
            },
            originalError === undefined ? undefined : toError(originalError),
        )
        this.name = 'DelegationError'
        this.reason = reason
    }
}
