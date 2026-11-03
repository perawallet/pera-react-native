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

import { BaseError, RpcRequestError } from 'viem'
import { EvmErrorCode, evmErrorCodeOf } from '../errors'

const afterUnconfirmedAttempt = new WeakSet<object>()

/**
 * A broadcast that failed on one URL without a node reply may still have
 * landed there, so a verdict from a later URL no longer says the transaction
 * is nowhere. Viem rewraps errors with the original as `cause`, so the mark
 * is looked up along the chain.
 */
export const markAfterUnconfirmedAttempt = (error: unknown): void => {
    if (typeof error === 'object' && error !== null) {
        afterUnconfirmedAttempt.add(error)
    }
}

export const isAfterUnconfirmedAttempt = (error: unknown): boolean =>
    error instanceof BaseError &&
    error.walk(
        link =>
            typeof link === 'object' &&
            link !== null &&
            afterUnconfirmedAttempt.has(link),
    ) !== null

// JSON-RPC internal error and resource unavailable: a node whose backend is
// down answers with these, having said nothing about the transaction.
const UPSTREAM_FAILURE_CODES: readonly number[] = [-32_603, -32_002]

/**
 * Only a JSON-RPC reply that judges the transaction is a verdict; a transport
 * failure, timeout, rate limit or a node reporting its own backend failure says
 * nothing about whether the node took it.
 */
export const isNodeReply = (error: unknown): boolean => {
    if (!(error instanceof BaseError)) return false
    const reply = error.walk(link => link instanceof RpcRequestError)
    return (
        reply instanceof RpcRequestError &&
        !UPSTREAM_FAILURE_CODES.includes(reply.code) &&
        evmErrorCodeOf(error) !== EvmErrorCode.RATE_LIMITED
    )
}

/** A node reply that is the whole story: no earlier URL left the outcome open. */
export const hasNodeVerdict = (error: unknown): boolean =>
    isNodeReply(error) && !isAfterUnconfirmedAttempt(error)
