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

import { ErrorSeverity } from '@perawallet/wallet-core-shared'

export const EvmErrorCode = {
    REVERTED: 'reverted',
    REVERTED_WITH_REASON: 'reverted_with_reason',
    OUT_OF_GAS: 'out_of_gas',
    NONCE_TOO_LOW: 'nonce_too_low',
    REPLACEMENT_UNDERPRICED: 'replacement_underpriced',
    INSUFFICIENT_FUNDS: 'insufficient_funds',
    RATE_LIMITED: 'rate_limited',
    UNKNOWN: 'unknown',
} as const

export type EvmErrorCode = (typeof EvmErrorCode)[keyof typeof EvmErrorCode]

type EvmErrorTraits = {
    titleKey?: string
    messageKey?: string
    severity: ErrorSeverity
    retryable: boolean
    expected?: boolean
}

// Literal keys on purpose: the unused-key lint claims en.json entries by
// literal, and ethereumModule.i18nKeys() reads them from here. `unknown` has
// no keys so it keeps BlockchainError's generic copy.
export const TRAITS: Record<EvmErrorCode, EvmErrorTraits> = {
    reverted: {
        titleKey: 'errors.evm.reverted.title',
        messageKey: 'errors.evm.reverted.body',
        severity: ErrorSeverity.HIGH,
        retryable: false,
    },
    reverted_with_reason: {
        titleKey: 'errors.evm.reverted_with_reason.title',
        // lanekeep-ignore-next-line pera/error-params-match-copy reason: the EvmError constructor only keeps this code when params.reason is set
        messageKey: 'errors.evm.reverted_with_reason.body',
        severity: ErrorSeverity.HIGH,
        retryable: false,
    },
    out_of_gas: {
        titleKey: 'errors.evm.out_of_gas.title',
        messageKey: 'errors.evm.out_of_gas.body',
        severity: ErrorSeverity.MEDIUM,
        retryable: false,
    },
    nonce_too_low: {
        titleKey: 'errors.evm.nonce_too_low.title',
        messageKey: 'errors.evm.nonce_too_low.body',
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
    },
    replacement_underpriced: {
        titleKey: 'errors.evm.replacement_underpriced.title',
        messageKey: 'errors.evm.replacement_underpriced.body',
        severity: ErrorSeverity.MEDIUM,
        retryable: false,
    },
    insufficient_funds: {
        titleKey: 'errors.evm.insufficient_funds.title',
        messageKey: 'errors.evm.insufficient_funds.body',
        severity: ErrorSeverity.MEDIUM,
        retryable: false,
    },
    rate_limited: {
        titleKey: 'errors.evm.rate_limited.title',
        messageKey: 'errors.evm.rate_limited.body',
        severity: ErrorSeverity.LOW,
        retryable: true,
        expected: true,
    },
    unknown: {
        severity: ErrorSeverity.HIGH,
        retryable: false,
    },
}

export const EVM_ERROR_I18N_KEYS: readonly string[] = Object.values(
    TRAITS,
).flatMap(({ titleKey, messageKey }) =>
    [titleKey, messageKey].filter((key): key is string => key !== undefined),
)
