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

import { Decimal } from 'decimal.js'
import type {
    AddressCodec,
    ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { uriSchemeOf, type DeeplinkChainAdapter } from '../chain-adapter'

export const fakeDeeplinkAdapter = (
    chainId: ChainId,
    schemes: readonly string[],
    codec: AddressCodec,
): DeeplinkChainAdapter => {
    const canParse = (input: string): boolean =>
        schemes.includes(uriSchemeOf(input) ?? '')

    return {
        chainId,
        schemes,
        canParse,
        parse: input => {
            if (!canParse(input)) return { ok: false, reason: 'malformed' }
            const rest = input.slice(input.indexOf(':') + 1)
            const queryAt = rest.indexOf('?')
            const target = queryAt === -1 ? rest : rest.slice(0, queryAt)
            const search = queryAt === -1 ? '' : rest.slice(queryAt + 1)

            if (target.includes('@')) {
                return { ok: false, reason: 'unsupported-network' }
            }
            if (!codec.isValid(target))
                return { ok: false, reason: 'malformed' }

            const amount = new URLSearchParams(search).get('amount')
            if (amount === null) {
                return {
                    ok: true,
                    intent: {
                        kind: 'address',
                        target: { chainId },
                        address: target,
                    },
                }
            }
            if (!/^\d+$/.test(amount)) return { ok: false, reason: 'malformed' }
            return {
                ok: true,
                intent: {
                    kind: 'payment',
                    target: { chainId },
                    recipient: target,
                    amount: new Decimal(amount),
                },
            }
        },
        toAssetRef: raw =>
            /^\d+$/.test(raw) ? { chainId, assetId: raw } : undefined,
    }
}
