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
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useAccountAssetsQuery } from '../useAccountAssetsQuery'
import { useTokenInboxQuery } from '../useTokenInboxQuery'

vi.mock('../useAccountAssetsQuery', () => ({
    useAccountAssetsQuery: vi.fn(() => ({ holdings: [], isPending: false })),
}))

vi.mock('../../chainProtocol', () => ({
    receivesUnaskedAssets: (chainId: string) => chainId === 'ethereum',
}))

const ETHEREUM: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ALGORAND: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

describe('useTokenInboxQuery', () => {
    it('reads the held, unhidden, unapproved tokens of the chains that receive them unasked', () => {
        renderHook(() =>
            useTokenInboxQuery([
                { address: '0xabc', scope: ETHEREUM },
                { address: 'ALGO', scope: ALGORAND },
            ]),
        )

        expect(useAccountAssetsQuery).toHaveBeenCalledWith(
            [{ address: '0xabc', scope: ETHEREUM }],
            {
                sortMode: 'alphabeticalAsc',
                filters: {
                    hideNfts: true,
                    hideZeroBalance: true,
                    onlyUnapproved: true,
                },
            },
        )
    })
})
