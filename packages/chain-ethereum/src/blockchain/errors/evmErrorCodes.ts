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

import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import { ErrorSeverity } from '@perawallet/wallet-core-shared'

export const EvmErrorCode = {
    REVERTED: 'reverted',
    REVERTED_WITH_REASON: 'reverted_with_reason',
    OUT_OF_GAS: 'out_of_gas',
    NONCE_TOO_LOW: 'nonce_too_low',
    REPLACEMENT_UNDERPRICED: 'replacement_underpriced',
    REPLACED_TRANSACTION_CONFIRMED: 'replaced_transaction_confirmed',
    INSUFFICIENT_FUNDS: 'insufficient_funds',
    RATE_LIMITED: 'rate_limited',
    UNKNOWN: 'unknown',
} as const

export type EvmErrorCode = (typeof EvmErrorCode)[keyof typeof EvmErrorCode]

type EvmErrorTraits = {
    titleKey?: I18nKey
    messageKey?: I18nKey
    severity: ErrorSeverity
    retryable: boolean
    expected?: boolean
}

// `unknown` has no keys so it keeps BlockchainError's generic copy.
export const TRAITS: Record<EvmErrorCode, EvmErrorTraits> = {
    reverted: {
        titleKey: i18nKey('errors.evm.reverted.title'),
        messageKey: i18nKey('errors.evm.reverted.body'),
        severity: ErrorSeverity.HIGH,
        retryable: false,
    },
    reverted_with_reason: {
        titleKey: i18nKey('errors.evm.reverted_with_reason.title'),
        // lanekeep-ignore-next-line pera/error-params-match-copy reason: the EvmError constructor only keeps this code when params.reason is set
        messageKey: i18nKey('errors.evm.reverted_with_reason.body'),
        severity: ErrorSeverity.HIGH,
        retryable: false,
        expected: true,
    },
    out_of_gas: {
        titleKey: i18nKey('errors.evm.out_of_gas.title'),
        messageKey: i18nKey('errors.evm.out_of_gas.body'),
        severity: ErrorSeverity.MEDIUM,
        retryable: false,
        expected: true,
    },
    nonce_too_low: {
        titleKey: i18nKey('errors.evm.nonce_too_low.title'),
        messageKey: i18nKey('errors.evm.nonce_too_low.body'),
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
    },
    replacement_underpriced: {
        titleKey: i18nKey('errors.evm.replacement_underpriced.title'),
        messageKey: i18nKey('errors.evm.replacement_underpriced.body'),
        severity: ErrorSeverity.MEDIUM,
        retryable: false,
        expected: true,
    },
    replaced_transaction_confirmed: {
        titleKey: i18nKey('errors.evm.replaced_transaction_confirmed.title'),
        messageKey: i18nKey('errors.evm.replaced_transaction_confirmed.body'),
        severity: ErrorSeverity.MEDIUM,
        retryable: false,
        // A speed-up or cancel losing the race to its original is ordinary timing.
        expected: true,
    },
    insufficient_funds: {
        titleKey: i18nKey('errors.evm.insufficient_funds.title'),
        // lanekeep-ignore-next-line pera/error-params-match-copy reason: toEvmError always sets params.symbol, the chain's native coin
        messageKey: i18nKey('errors.evm.insufficient_funds.body'),
        severity: ErrorSeverity.MEDIUM,
        retryable: false,
        expected: true,
    },
    rate_limited: {
        titleKey: i18nKey('errors.evm.rate_limited.title'),
        messageKey: i18nKey('errors.evm.rate_limited.body'),
        severity: ErrorSeverity.LOW,
        retryable: true,
        expected: true,
    },
    unknown: {
        severity: ErrorSeverity.HIGH,
        retryable: false,
    },
}
