/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import type { Arc0027Handler } from '../arc0027/dispatcher'
import { Arc0027Error } from '../arc0027/errors'
import { ARC0027_ERROR_CODES } from '../arc0027/types'
import { buildWcError, buildWcResult, parseWcRequest } from './wcCodec'

/** WalletConnect JSON-RPC error codes (align with WC conventions). */
const WC_USER_REJECTED = 4001
const WC_UNKNOWN = 4000

export type WalletConnectRouteConfig = {
    /** The arc0027 sign_transactions handler (resolves `{ stxns }`). */
    signTransactions: Arc0027Handler
    /** The arc0027 sign_message handler (resolves `{ signature }`). */
    signMessage: Arc0027Handler
    /** The single account bound during the Liquid Auth ceremony. */
    account: string
    genesisHash: string
    genesisId: string
}

/**
 * Routes WalletConnect JSON-RPC requests carried over the Liquid Auth data
 * channel onto the arc0027 handlers (same signing pipeline). Connection consent
 * + account selection are owned by the Liquid Auth flow, so `session_request`
 * is auto-approved with the bound account and only operational methods do work.
 */
export const createWalletConnectRoute =
    (
        config: WalletConnectRouteConfig,
    ): ((raw: string) => Promise<string | null>) =>
    async (raw: string): Promise<string | null> => {
        const request = parseWcRequest(raw)
        if (!request) return null

        try {
            switch (request.method) {
                case 'algo_signTxn': {
                    const txns = Array.isArray(request.params)
                        ? (request.params[0] ?? [])
                        : []
                    const result = await config.signTransactions({
                        id: String(request.id),
                        reference: 'arc0027:sign_transactions:request',
                        params: { txns },
                    } as Parameters<Arc0027Handler>[0])
                    return buildWcResult(
                        request.id,
                        (result as { stxns?: unknown }).stxns ?? [],
                    )
                }
                case 'algo_signData': {
                    // parseWcRequest guarantees params is an array.
                    const data = request.params[0]
                    const result = await config.signMessage({
                        id: String(request.id),
                        reference: 'arc0027:sign_message:request',
                        params: data as Record<string, unknown>,
                    } as Parameters<Arc0027Handler>[0])
                    return buildWcResult(
                        request.id,
                        (result as { signature?: unknown }).signature,
                    )
                }
                case 'session_request':
                    return buildWcResult(request.id, {
                        accounts: [config.account],
                        genesisHash: config.genesisHash,
                        genesisId: config.genesisId,
                    })
                default:
                    return buildWcError(
                        request.id,
                        WC_UNKNOWN,
                        `Unsupported method: ${request.method}`,
                    )
            }
        } catch (error) {
            // Map a user-reject from the arc0027 handlers to WC's 4001; anything
            // else is a generic 4000. Tied to the arc0027 constant (not a bare
            // 4001) so a future renumbering can't silently mis-map rejections.
            const code =
                error instanceof Arc0027Error &&
                error.code === ARC0027_ERROR_CODES.MethodCanceledError
                    ? WC_USER_REJECTED
                    : WC_UNKNOWN
            return buildWcError(
                request.id,
                code,
                error instanceof Error ? error.message : 'Request failed',
            )
        }
    }
