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

export const ALGORAND_SCHEME = 'algorand://'
type AlgorandURI = PaymentTx | KeyRegTx | NoopTx | AppQuery | AssetQuery

export function parseAlgorandURI(uri: string): AlgorandURI | null {
    try {
        if (!uri.startsWith(ALGORAND_SCHEME)) return null
        const stripped = uri.slice(ALGORAND_SCHEME.length)

        // Split network/address vs query
        const [beforeQuery, query] = stripped.split('?', 2)

        // Split network/address
        let network: Network | undefined
        let path = beforeQuery

        // Network specified with netauth
        if (beforeQuery.includes('/')) {
            const slashIndex = beforeQuery.indexOf('/')
            const netPart = beforeQuery.slice(0, slashIndex)
            const rest = beforeQuery.slice(slashIndex + 1)

            if (netPart.startsWith('net:') || netPart.startsWith('gh:')) {
                if (netPart.startsWith('net:')) network = netPart.slice(4)
                else network = netPart
                path = rest
            }
        }

        // Check for special paths: app/, asset/
        if (path.startsWith('app/')) {
            const appId = path.slice(4)
            // ARC-90: appid = 1*DIGIT
            if (!/^\d+$/.test(appId)) return null

            const params: Record<string, string> = {}
            if (query) {
                query.split('&').forEach(kv => {
                    const [k, v] = kv.split('=')
                    params[k] = v ? decodeURIComponent(v) : ''
                })
            }
            return { type: 'appquery', network, appId, params }
        } else if (path.startsWith('asset/')) {
            const assetId = path.slice(6)
            // ARC-90: assetid = 1*DIGIT
            if (!/^\d+$/.test(assetId)) return null

            const params: Record<string, string> = {}
            if (query) {
                query.split('&').forEach(kv => {
                    const [k, v] = kv.split('=')
                    params[k] = v ? decodeURIComponent(v) : ''
                })
            }
            return { type: 'assetquery', network, assetId, params }
        } else {
            const address = path
            const params: Record<string, string> = {}
            if (query) {
                query.split('&').forEach(kv => {
                    const [k, v] = kv.split('=')
                    params[k] = v ? decodeURIComponent(v) : ''
                })
            }

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
