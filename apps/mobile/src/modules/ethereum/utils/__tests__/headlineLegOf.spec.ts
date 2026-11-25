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
import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import type { BalanceChange } from '@perawallet/wallet-core-chain-contract'
import { headlineFiatOf, headlineLegOf } from '../headlineLegOf'

const ETH = { chainId: 'base', assetId: 'native' } as const
const WETH = { chainId: 'base', assetId: '0xweth' } as const
const AWETH = { chainId: 'base', assetId: '0xaweth' } as const
const leg = (
    assetRef: BalanceChange['assetRef'],
    value: string,
): BalanceChange => ({ assetRef, value: new Decimal(value) })
const ETHER = { assetId: 'native', unitName: 'ETH', decimals: 18 }

describe('headlineLegOf', () => {
    it('leads with the native leg, whichever way it moved', () => {
        const received = leg(ETH, '300000000000000')

        expect(headlineLegOf([leg(AWETH, '-299'), received], 'native')).toBe(
            received,
        )
    })

    it('leads with the one asset spent when no native leg moved', () => {
        const spent = leg(WETH, '-5')

        expect(headlineLegOf([spent, leg(AWETH, '5')], 'native')).toBe(spent)
    })

    it('leads with a lone incoming leg', () => {
        const only = leg(AWETH, '5')

        expect(headlineLegOf([only], 'native')).toBe(only)
    })

    it.each([
        ['nothing moved', []],
        ['two assets were spent', [leg(WETH, '-1'), leg(AWETH, '-1')]],
        ['two assets arrived', [leg(WETH, '1'), leg(AWETH, '1')]],
    ])('picks none when %s', (_label, changes) => {
        expect(headlineLegOf(changes, 'native')).toBeUndefined()
    })
})

describe('headlineFiatOf', () => {
    it('gives the leg unsigned, in display units', () => {
        const amount = headlineFiatOf(
            leg(ETH, '-3000000000000000'),
            ETHER,
            new Map(),
        )

        expect(amount?.asset).toBe(ETHER)
        expect(amount?.value.toString()).toBe('0.003')
    })

    it('gives nothing for a token the store does not hold', () => {
        expect(
            headlineFiatOf(leg(WETH, '-5'), ETHER, new Map()),
        ).toBeUndefined()
    })
})
