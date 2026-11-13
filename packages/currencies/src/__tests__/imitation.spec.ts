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

import { describe, it, expect, vi } from 'vitest'
import { imitatedCurrencyOf } from '../imitation'

vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-assets')
    >()),
    findNativeAsset: (chainId: string) => {
        if (chainId === 'algorand') return { assetId: '0', unitName: 'ALGO' }
        if (chainId === 'ethereum') {
            return { assetId: 'native', unitName: 'ETH' }
        }
        return undefined
    },
}))

const algorand = (assetId: string) => ({ chainId: 'algorand', assetId })

describe('imitatedCurrencyOf', () => {
    it.each(['ALGO', 'algo', ' Algo '])(
        'flags %j on a non-native asset as the native ticker',
        unitName => {
            expect(imitatedCurrencyOf(algorand('741'), unitName)).toBe('ALGO')
        },
    )

    it('never flags the native asset itself', () => {
        expect(imitatedCurrencyOf(algorand('0'), 'ALGO')).toBeNull()
    })

    it.each([
        ['USD', 'USD'],
        ['eur', 'EUR'],
        ['gbp', 'GBP'],
    ])('flags %j as the fiat code %j', (unitName, code) => {
        expect(imitatedCurrencyOf(algorand('741'), unitName)).toBe(code)
    })

    it.each(['USDC', 'xALGO', 'ALGOS', 'XAU'])('leaves %j alone', unitName => {
        expect(imitatedCurrencyOf(algorand('741'), unitName)).toBeNull()
    })

    it.each(['', undefined])('ignores a missing name %j', unitName => {
        expect(imitatedCurrencyOf(algorand('741'), unitName)).toBeNull()
    })

    it('reserves only the ticker of the asset own chain', () => {
        const erc20 = { chainId: 'ethereum', assetId: '0xabc' }

        expect(imitatedCurrencyOf(erc20, 'eth')).toBe('ETH')
        expect(imitatedCurrencyOf(erc20, 'ALGO')).toBeNull()
    })

    it('still checks fiat codes on a chain with no assets adapter', () => {
        const unknown = { chainId: 'solana', assetId: 'x' }

        expect(imitatedCurrencyOf(unknown, 'USD')).toBe('USD')
        expect(imitatedCurrencyOf(unknown, 'ALGO')).toBeNull()
    })
})
