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
import { EvmError, type EvmErrorParams } from './EvmError'
import { EvmErrorCode } from './evmErrorCodes'

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
