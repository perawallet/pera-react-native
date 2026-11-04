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

import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
    ChainScope,
    SpendAllowance,
    SpendApproval,
} from '@perawallet/wallet-core-chain-contract'
import { useSpendApprovalTitle } from '../useSpendApprovalTitle'

const { mockUseSingleAssetDetailsQuery, mockT } = vi.hoisted(() => ({
    mockUseSingleAssetDetailsQuery: vi.fn(),
    mockT: vi.fn(
        (key: string, params?: Record<string, string>) =>
            `${key}|${JSON.stringify(params ?? {})}`,
    ),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useSingleAssetDetailsQuery: mockUseSingleAssetDetailsQuery,
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: mockT }),
}))

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const TOKEN = '0x8ad3c73f833d3f9a523ab01476625f269aeb7cf0'

const token = (assetId = TOKEN): SpendAllowance => ({
    assetRef: { chainId: 'ethereum', assetId },
})

const approval = (overrides: Partial<SpendApproval> = {}): SpendApproval => ({
    spender: '0x23617e59A5925b2A4Bf75d73ff6711cD0b29De85',
    allowances: [token()],
    isLongLived: false,
    ...overrides,
})

const ROUTER = {
    name: 'Uniswap Universal Router',
    projectDomain: 'uniswap.org',
}

const titleOf = (value: SpendApproval) =>
    renderHook(() => useSpendApprovalTitle(value, SCOPE)).result.current

describe('useSpendApprovalTitle', () => {
    beforeEach(() => {
        mockUseSingleAssetDetailsQuery.mockReset()
        mockUseSingleAssetDetailsQuery.mockReturnValue({
            data: { unitName: 'TSLAx' },
        })
    })

    it('names the known spender and the one token it may use', () => {
        expect(titleOf(approval({ knownSpender: ROUTER }))).toBe(
            'signing.spend_approval.allow_title|{"spender":"Uniswap Universal Router","asset":"TSLAx"}',
        )
        expect(mockUseSingleAssetDetailsQuery).toHaveBeenCalledWith(
            TOKEN,
            SCOPE,
        )
    })

    it('says another address when the spender is not in the registry', () => {
        expect(titleOf(approval())).toBe(
            'signing.spend_approval.allow_title_unknown|{"asset":"TSLAx"}',
        )
    })

    it('falls back to your assets for a batch, an NFT, or a token with no record yet', () => {
        const nft: SpendAllowance = {
            ...token('0xpositions/7'),
            amount: new Decimal(1),
            nft: { collection: '0xpositions', tokenId: '7' },
        }

        expect(
            titleOf(
                approval({
                    knownSpender: ROUTER,
                    allowances: [token(), token('0xusdc')],
                }),
            ),
        ).toBe(
            'signing.spend_approval.allow_title_assets|{"spender":"Uniswap Universal Router"}',
        )
        expect(mockUseSingleAssetDetailsQuery).toHaveBeenLastCalledWith(
            '',
            SCOPE,
        )
        expect(titleOf(approval({ allowances: [nft] }))).toBe(
            'signing.spend_approval.allow_title_unknown_assets|{}',
        )

        mockUseSingleAssetDetailsQuery.mockReturnValue({ data: undefined })
        expect(titleOf(approval())).toBe(
            'signing.spend_approval.allow_title_unknown_assets|{}',
        )
    })
})

describe('useSpendApprovalTitle without an approval', () => {
    it('is undefined and looks nothing up', () => {
        mockUseSingleAssetDetailsQuery.mockReturnValue({ data: undefined })

        const { result } = renderHook(() =>
            useSpendApprovalTitle(undefined, SCOPE),
        )

        expect(result.current).toBeUndefined()
        expect(mockUseSingleAssetDetailsQuery).toHaveBeenLastCalledWith(
            '',
            SCOPE,
        )
    })
})
