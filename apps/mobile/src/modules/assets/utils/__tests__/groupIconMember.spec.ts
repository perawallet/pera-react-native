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

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import type { GroupedHoldingMember } from '../groupedHoldings'
import { groupIconMemberOf } from '../groupIconMember'

type Holding = { scope: ChainScope; assetId: string }

const token = (logo?: string): PeraAsset =>
    ({
        assetId: 'token',
        name: 'USD Coin',
        peraMetadata: { logo },
    }) as PeraAsset

const member = (
    chainId: 'algorand' | 'ethereum',
    asset: Nullable<PeraAsset>,
    assetId: string = chainId,
): GroupedHoldingMember<Holding> => ({
    holding: { scope: { chainId, networkId: 'mainnet' }, assetId },
    asset,
    displayAmount: new Decimal(1),
    usdPrice: new Decimal(1),
    isUnreadZero: false,
})

describe('groupIconMemberOf', () => {
    beforeEach(() => {
        registerEthereumChain()
    })

    afterEach(() => {
        restoreAlgorandOnlyChains()
    })

    it("takes a chain's native coin over a token with a logo that comes first", () => {
        const native = member(
            'ethereum',
            { assetId: 'native', name: 'Ether' } as PeraAsset,
            'native',
        )

        expect(
            groupIconMemberOf([
                member('algorand', token('https://cdn/usdc.png')),
                native,
            ]),
        ).toBe(native)
    })

    it('takes the first member with a logo when none is native', () => {
        const withLogo = member('ethereum', token('https://cdn/usdc.png'))

        expect(groupIconMemberOf([member('algorand', token()), withLogo])).toBe(
            withLogo,
        )
    })

    it('falls back to the first member when none has a logo', () => {
        const first = member('algorand', null)

        expect(groupIconMemberOf([first, member('ethereum', token())])).toBe(
            first,
        )
    })

    it('has no member to draw from in an empty group', () => {
        expect(groupIconMemberOf([])).toBeUndefined()
    })
})
