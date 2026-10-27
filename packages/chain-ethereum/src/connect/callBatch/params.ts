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

import { isHex } from 'viem'
import type { Address } from 'viem'
import type { DappRequestValidation } from '@perawallet/wallet-core-connections'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    validateEthereumSendTransaction,
    type EthereumSendTransactionRequest,
    type EthereumSendTransactionSession,
} from '../sendTransaction'
import { EIP5792_ERROR_CODE } from './codes'

/** A dApp's `wallet_sendCalls` once validated. */
export type EthereumCallBatchRequest = {
    /** The dApp's own id; absent when the wallet picks one. */
    batchId?: string
    from: Address
    calls: EthereumSendTransactionRequest[]
}

// Each call is reviewed and run on its own, so a long batch is a long review.
export const MAX_CALLS_PER_BATCH = 10

// EIP-5792 caps an app-supplied id at 4096 bytes.
const MAX_BATCH_ID_LENGTH = 4096

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

const firstPositional = (params: unknown): unknown =>
    Array.isArray(params) ? (params as unknown[])[0] : params

// The wallet understands no capability in a request, so only optional ones pass.
const hasRequiredCapability = (capabilities: unknown): boolean =>
    isRecord(capabilities) &&
    Object.values(capabilities).some(
        capability => !(isRecord(capability) && capability.optional === true),
    )

/**
 * The refusals the params alone decide, answered before any session lookup so
 * nothing reaches the user. Null when the batch goes on to validation.
 */
export const refuseUnsupportedSendCalls = (
    params: unknown,
): Nullable<{ code: number; message: string }> => {
    const batch = firstPositional(params)
    if (!isRecord(batch)) return null
    if (batch.atomicRequired === true) {
        return {
            code: EIP5792_ERROR_CODE.atomicityNotSupported,
            message: 'Atomic execution is not supported',
        }
    }
    const calls = Array.isArray(batch.calls) ? (batch.calls as unknown[]) : []
    if (
        hasRequiredCapability(batch.capabilities) ||
        calls.some(
            call => isRecord(call) && hasRequiredCapability(call.capabilities),
        )
    ) {
        return {
            code: EIP5792_ERROR_CODE.unsupportedCapability,
            message: 'A required capability is not supported',
        }
    }
    return null
}

type Validation = DappRequestValidation<EthereumCallBatchRequest>

const invalid = (message: string): Validation => ({
    ok: false,
    failure: 'invalid-params',
    message,
})

/**
 * Applies `eth_sendTransaction`'s rules to every call, with the batch's
 * `from`. Fee, gas and nonce are the wallet's to pick, so calls carry none.
 */
export const validateEthereumSendCalls = (
    params: unknown,
    session: EthereumSendTransactionSession,
): Validation => {
    const batch = firstPositional(params)
    if (!isRecord(batch)) return invalid('The batch must be an object')
    if (typeof batch.atomicRequired !== 'boolean') {
        return invalid('atomicRequired must be a boolean')
    }
    if (batch.atomicRequired) {
        return {
            ok: false,
            failure: 'coded',
            code: EIP5792_ERROR_CODE.atomicityNotSupported,
            message: 'Atomic execution is not supported',
        }
    }
    if (
        typeof batch.chainId !== 'string' ||
        !isHex(batch.chainId, { strict: true }) ||
        batch.chainId.length <= 2
    ) {
        return invalid('The chainId is not a hex quantity')
    }
    if (
        session.eip155ChainId === undefined ||
        BigInt(batch.chainId) !== BigInt(session.eip155ChainId)
    ) {
        return {
            ok: false,
            failure: 'coded',
            code: EIP5792_ERROR_CODE.unsupportedChainId,
            message: 'The chainId is not the active chain',
        }
    }
    if (
        batch.id !== undefined &&
        (typeof batch.id !== 'string' ||
            batch.id.length === 0 ||
            batch.id.length > MAX_BATCH_ID_LENGTH)
    ) {
        return invalid(
            'The id must be a non-empty string of at most 4096 characters',
        )
    }
    if (
        !Array.isArray(batch.calls) ||
        batch.calls.length === 0 ||
        batch.calls.length > MAX_CALLS_PER_BATCH
    ) {
        return invalid(
            `A batch holds between 1 and ${MAX_CALLS_PER_BATCH} calls`,
        )
    }
    // A dApp that names no sender means the account it was given first.
    const from = batch.from ?? session.authorizedAccounts[0]

    const calls: EthereumSendTransactionRequest[] = []
    for (const [index, call] of (batch.calls as unknown[]).entries()) {
        if (!isRecord(call)) return invalid(`Call ${index} must be an object`)
        const result = validateEthereumSendTransaction(
            { from, to: call.to, value: call.value, data: call.data },
            session,
        )
        if (!result.ok) {
            return { ...result, message: `Call ${index}: ${result.message}` }
        }
        calls.push(result.request)
    }
    return {
        ok: true,
        request: {
            ...(typeof batch.id === 'string' && { batchId: batch.id }),
            from: calls[0].from,
            calls,
        },
    }
}
