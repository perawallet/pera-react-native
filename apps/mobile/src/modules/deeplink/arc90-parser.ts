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

import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { ALGORAND_SCHEME } from './constants'

type Network = 'mainnet' | 'testnet' | 'betanet' | string

interface BaseParams {
    network?: Network
    address?: string
    params?: Record<string, string>
}

interface PaymentTx extends BaseParams {
    type: 'payment'
}

interface KeyRegTx extends BaseParams {
    type: 'keyreg'
}

interface NoopTx extends BaseParams {
    type: 'noop'
}

interface AppQuery extends BaseParams {
    type: 'appquery'
    appId: string
}

interface AssetQuery extends BaseParams {
    type: 'assetquery'
    assetId: string
}

type AlgorandURI = PaymentTx | KeyRegTx | NoopTx | AppQuery | AssetQuery

const ALGORAND_URI_PREFIX = `${ALGORAND_SCHEME}://`

const parseQueryParams = (
    query: string | undefined,
): Record<string, string> => {
    const params: Record<string, string> = {}
    if (query) {
        query.split('&').forEach(kv => {
            const [k, v] = kv.split('=')
            params[k] = v ? decodeURIComponent(v) : ''
        })
    }
    return params
}

export function parseAlgorandURI(uri: string): Nullable<AlgorandURI> {
    try {
        if (!uri.startsWith(ALGORAND_URI_PREFIX)) return null
        const stripped = uri.slice(ALGORAND_URI_PREFIX.length)

        // Split network/address vs query
        const [beforeQuery, query] = stripped.split('?', 2)

        // Split network/address
        let network: Optional<Network>
        let path = beforeQuery

        // Network specified with netauth
        if (beforeQuery.includes('/')) {
            const slashIndex = beforeQuery.indexOf('/')
            const netPart = beforeQuery.slice(0, slashIndex)
            const rest = beforeQuery.slice(slashIndex + 1)

            if (netPart.startsWith('net:') || netPart.startsWith('gh:')) {
                // Strip BOTH prefixes: leaving `gh:` attached made every
                // consumer responsible for knowing one form carries it and
                // the other doesn't. `net:` yields a genesis id
                // (`testnet-v1.0`), `gh:` a base64 genesis hash — callers
                // that care match against both.
                network = netPart.startsWith('net:')
                    ? netPart.slice(4)
                    : netPart.slice(3)
                path = rest
            }
        }

        // RFC 3986 permits an empty final segment, and Pera's own app-action
        // links are written with one. Left in place it rides along on the
        // address, fails validation, and takes the whole URI down to `null` —
        // which the QR scanner treats as an unrecognized barcode and silently
        // re-arms on, giving the user no feedback whatsoever.
        if (path.endsWith('/')) {
            path = path.slice(0, -1)
        }

        // Check for special paths: app/, asset/
        if (path.startsWith('app/')) {
            const appId = path.slice(4)
            // ARC-90: appid = 1*DIGIT
            if (!/^\d+$/.test(appId)) return null

            const params = parseQueryParams(query)
            return { type: 'appquery', network, appId, params }
        } else if (path.startsWith('asset/')) {
            const assetId = path.slice(6)
            // ARC-90: assetid = 1*DIGIT
            if (!/^\d+$/.test(assetId)) return null

            const params = parseQueryParams(query)
            return { type: 'assetquery', network, assetId, params }
        } else {
            const address = path
            const params = parseQueryParams(query)

            // Determine type by `type` param
            const typeParam = params['type']
            if (typeParam === 'appl')
                return { type: 'noop', network, address, params }
            if (typeParam === 'keyreg')
                return { type: 'keyreg', network, address, params }
            return { type: 'payment', network, address, params }
        }
    } catch {
        return null
    }
}
