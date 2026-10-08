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
    BaseError,
    ContractFunctionRevertedError,
    ExecutionRevertedError,
    HttpRequestError,
    InsufficientFundsError,
    IntrinsicGasTooLowError,
    LimitExceededRpcError,
    NonceTooLowError,
} from 'viem'
import { BlockchainError, ErrorSeverity } from '@perawallet/wallet-core-shared'

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
const TRAITS: Record<EvmErrorCode, EvmErrorTraits> = {
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

export type EvmErrorParams = { reason?: string }

/**
 * A viem or JSON-RPC failure classified into a stable {@link EvmErrorCode}.
 * `message` is a log label; the UI renders `metadata.messageKey`.
 */
export class EvmError extends BlockchainError {
    readonly code: EvmErrorCode
    readonly params: EvmErrorParams

    constructor(
        requestedCode: EvmErrorCode,
        params: EvmErrorParams = {},
        originalError?: Error,
    ) {
        // Without a reason the copy would render a bare {{reason}} placeholder.
        const code =
            requestedCode === EvmErrorCode.REVERTED_WITH_REASON &&
            !params.reason
                ? EvmErrorCode.REVERTED
                : requestedCode
        const { titleKey, messageKey, severity, retryable, expected } =
            TRAITS[code]
        super(
            `[evm:${code}] ${originalError?.message ?? code}`,
            originalError,
            {
                severity,
                retryable,
                expected,
                // An explicit `messageKey: undefined` would wipe the generic default.
                ...(titleKey && { titleKey }),
                ...(messageKey && { messageKey }),
                params: { code, ...params },
            },
        )
        this.name = 'EvmError'
        this.code = code
        this.params = params
    }
}

export const isEvmError = (error: unknown): error is EvmError =>
    error instanceof EvmError

// geth/reth say "replacement transaction underpriced"; erigon and nethermind
// say "replacement fee too low". viem has no class for either.
const REPLACEMENT_UNDERPRICED =
    /replacement transaction underpriced|replacement fee too low|replacement_underpriced/i

// viem files geth's estimateGas "gas required exceeds allowance" under
// ExecutionRevertedError, so this must be checked before the revert branch.
const OUT_OF_GAS = /out of gas|gas required exceeds allowance/i

const EXECUTION_REVERTED_REASON = /^Execution reverted with reason: (.+)\.$/s

const chainOf = (error: unknown): unknown[] => {
    const chain: unknown[] = []
    let current: unknown = error
    while (current !== undefined && current !== null && chain.length < 16) {
        chain.push(current)
        current =
            typeof current === 'object' && 'cause' in current
                ? current.cause
                : undefined
    }
    return chain
}

const textOf = (error: unknown): string => {
    if (error instanceof BaseError) {
        return `${error.shortMessage}\n${error.details}`
    }
    return error instanceof Error ? error.message : ''
}

const revertReasonOf = (chain: unknown[]): string | undefined => {
    for (const link of chain) {
        if (link instanceof ContractFunctionRevertedError && link.reason) {
            return link.reason
        }
    }
    for (const link of chain) {
        if (link instanceof ExecutionRevertedError) {
            const reason = EXECUTION_REVERTED_REASON.exec(
                link.shortMessage,
            )?.[1]
            if (reason) return reason
        }
    }
    return undefined
}

const classify = (
    error: unknown,
): { code: EvmErrorCode; params?: EvmErrorParams } => {
    const chain = chainOf(error)
    const has = (type: abstract new (...args: never[]) => unknown) =>
        chain.some(link => link instanceof type)
    const text = chain.map(textOf).join('\n')

    if (
        has(LimitExceededRpcError) ||
        chain.some(
            link => link instanceof HttpRequestError && link.status === 429,
        )
    ) {
        return { code: EvmErrorCode.RATE_LIMITED }
    }
    if (REPLACEMENT_UNDERPRICED.test(text)) {
        return { code: EvmErrorCode.REPLACEMENT_UNDERPRICED }
    }
    if (has(NonceTooLowError)) return { code: EvmErrorCode.NONCE_TOO_LOW }
    if (has(InsufficientFundsError)) {
        return { code: EvmErrorCode.INSUFFICIENT_FUNDS }
    }
    if (has(IntrinsicGasTooLowError) || OUT_OF_GAS.test(text)) {
        return { code: EvmErrorCode.OUT_OF_GAS }
    }
    if (has(ContractFunctionRevertedError) || has(ExecutionRevertedError)) {
        const reason = revertReasonOf(chain)
        return reason
            ? { code: EvmErrorCode.REVERTED_WITH_REASON, params: { reason } }
            : { code: EvmErrorCode.REVERTED }
    }
    return { code: EvmErrorCode.UNKNOWN }
}

/** Classifies any thrown value from a viem client or JSON-RPC node. */
export const toEvmError = (error: unknown): EvmError => {
    if (error instanceof EvmError) return error
    const { code, params } = classify(error)
    return new EvmError(
        code,
        params,
        error instanceof Error ? error : new Error(String(error)),
    )
}
