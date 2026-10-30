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
import { toError, type Optional } from '@perawallet/wallet-core-shared'
import { EvmError, type EvmErrorParams } from './EvmError'
import { EvmErrorCode } from './evmErrorCodes'

// geth/reth say "replacement transaction underpriced"; erigon and nethermind
// say "replacement fee too low". viem has no class for either.
const REPLACEMENT_UNDERPRICED =
    /replacement transaction underpriced|replacement fee too low|replacement_underpriced/i

// viem classifies these only from the call that raised them. A rejected
// eth_sendRawTransaction arrives as a plain InvalidInputRpcError, so match the
// node's text as well.
const NONCE_TOO_LOW = /nonce too low/i
const INSUFFICIENT_FUNDS = /insufficient funds/i

// viem files geth's estimateGas "gas required exceeds allowance" under
// ExecutionRevertedError, so this must be checked before the revert branch.
// A rejected eth_sendRawTransaction reaches viem as a plain InvalidInputRpcError,
// so "intrinsic gas too low" is matched as text too.
const OUT_OF_GAS =
    /out of gas|gas required exceeds allowance|intrinsic gas too low/i

// Anvil renders a Solidity custom error as `custom error 0x<selector>: <raw
// data bytes>`; the data is binary, so it is not a reason a user can read.
const CUSTOM_ERROR_PLACEHOLDER = /^custom error 0x[0-9a-f]{8}\b/i

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

const revertReasonOf = (chain: unknown[]): Optional<string> => {
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
            if (reason && !CUSTOM_ERROR_PLACEHOLDER.test(reason)) return reason
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
    const reverted =
        has(ContractFunctionRevertedError) || has(ExecutionRevertedError)
    // The text matches skip reverts: a token's own reason can say "nonce too low" or "insufficient funds".
    if (has(NonceTooLowError) || (!reverted && NONCE_TOO_LOW.test(text))) {
        return { code: EvmErrorCode.NONCE_TOO_LOW }
    }
    if (
        has(InsufficientFundsError) ||
        (!reverted && INSUFFICIENT_FUNDS.test(text))
    ) {
        return { code: EvmErrorCode.INSUFFICIENT_FUNDS }
    }
    if (has(IntrinsicGasTooLowError) || OUT_OF_GAS.test(text)) {
        return { code: EvmErrorCode.OUT_OF_GAS }
    }
    if (reverted) {
        const reason = revertReasonOf(chain)
        return reason
            ? { code: EvmErrorCode.REVERTED_WITH_REASON, params: { reason } }
            : { code: EvmErrorCode.REVERTED }
    }
    return { code: EvmErrorCode.UNKNOWN }
}

/** The code alone, for a caller that branches on it and shows no copy. */
export const evmErrorCodeOf = (error: unknown): EvmErrorCode =>
    error instanceof EvmError ? error.code : classify(error).code

/**
 * Classifies any thrown value from a viem client or JSON-RPC node.
 * `nativeSymbol` names the coin that pays gas, which the insufficient-funds
 * copy shows.
 */
export const toEvmError = (error: unknown, nativeSymbol: string): EvmError => {
    if (error instanceof EvmError) return error
    const { code, params } = classify(error)
    return new EvmError(
        code,
        { ...params, symbol: nativeSymbol },
        toError(error),
    )
}
