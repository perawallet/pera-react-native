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

import { ARC0001_MAX_TXN_B64_LENGTH } from '@perawallet/wallet-core-blockchain/arc0001/limits'
import {
    getNetworkConfig,
    Networks,
    type Network,
} from '@perawallet/wallet-core-config'
import type {
    DappRequestChainAdapter,
    DappSigningParamsResult,
} from '@perawallet/wallet-core-connections'
import { isArc60WirePayload } from '@perawallet/wallet-core-signing'
import { MAX_TRANSACTION_SIGN_REQUESTS } from '@perawallet/wallet-core-signing/constants'
import { ALGORAND_CHAIN_ID } from '../chain-id'

const BAKED_NETWORKS: Network[] = [
    Networks.mainnet,
    Networks.testnet,
    Networks.betanet,
]

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

const isWithinTxnBounds = (txns: unknown): boolean =>
    Array.isArray(txns) &&
    txns.length > 0 &&
    txns.length <= MAX_TRANSACTION_SIGN_REQUESTS &&
    txns.every(
        entry =>
            isRecord(entry) &&
            typeof entry.txn === 'string' &&
            entry.txn.length > 0 &&
            entry.txn.length <= ARC0001_MAX_TXN_B64_LENGTH,
    )

export const algorandDappRequestAdapter: DappRequestChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    // ARC-0001 requires a message that only echoes the dApp's own request. Other
    // signing errors wrap third-party text or interpolate held addresses.
    relayableErrorNames: ['Arc0001Error'],

    // Webview-compatible param shapes: `{ txns, opts?, metadata? }` for
    // ARC-0001; an ARC-60 wire object or `{ data: [...] }` for data. Only the
    // operation payload crosses into the registry; `opts`/`metadata` are
    // display hints the connection's own peer record supersedes.
    parseSigningParams(type, params): DappSigningParamsResult {
        if (type === 'sign-transactions') {
            if (params.txns === undefined) {
                return {
                    ok: false,
                    reason: 'missing',
                    message: 'Missing required param: txns',
                }
            }
            if (!isWithinTxnBounds(params.txns)) {
                return {
                    ok: false,
                    reason: 'out-of-bounds',
                    message: 'Request exceeds size limits',
                }
            }
            return { ok: true, payload: params.txns }
        }
        const payload = isArc60WirePayload(params) ? params : params.data
        if (payload === undefined) {
            return {
                ok: false,
                reason: 'missing',
                message: 'Missing required param: data',
            }
        }
        return { ok: true, payload }
    },

    // A custom network is reported as the baked network sharing its genesis
    // hash and never by name: the custom-network envelope is plaintext, so a
    // forged one with a MainNet hash and an attacker's node URLs must not make
    // the wallet tell a dApp "this is MainNet" — the hash check is what a dApp
    // actually validates.
    resolveReportedNetwork(network, customGenesisHash) {
        if (network !== Networks.custom) return network
        if (!customGenesisHash) return undefined
        return BAKED_NETWORKS.find(
            baked => getNetworkConfig(baked).genesisHash === customGenesisHash,
        )
    },
}
