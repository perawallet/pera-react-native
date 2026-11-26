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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ChainDescriptor } from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import { useSwapPayoutCard } from '../useSwapPayoutCard'

const mockOpenExplorerUrl = vi.fn()

vi.mock('@modules/webview', () => ({
    openExplorerUrl: (url: string) => mockOpenExplorerUrl(url),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, string>) =>
            params ? `${key}:${Object.values(params).join()}` : key,
    }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    getChainDescriptor: vi.fn(),
}))

const ETH = { chainId: 'ethereum', networkId: 'mainnet' } as const

describe('useSwapPayoutCard', () => {
    beforeEach(() => {
        mockOpenExplorerUrl.mockReset()
        vi.mocked(getChainDescriptor).mockReturnValue({
            displayName: 'Ethereum',
            explorer: {
                name: 'Etherscan',
                transactionUrl: (networkId: string, id: string) =>
                    networkId === 'custom'
                        ? undefined
                        : `https://etherscan.io/tx/${id}`,
            },
        } as unknown as ChainDescriptor)
    })

    it("opens a listed payout on its own chain's explorer", () => {
        const { result } = renderHook(() =>
            useSwapPayoutCard({ scope: ETH, transactionId: '0xpayout' }),
        )

        expect(result.current).toEqual(
            expect.objectContaining({
                isShown: true,
                isPending: false,
                label: 'transactions.common.view_swap_payout_in:Etherscan',
            }),
        )
        result.current.handleOpen?.()
        expect(mockOpenExplorerUrl).toHaveBeenCalledWith(
            'https://etherscan.io/tx/0xpayout',
        )
    })

    it('names the receive chain and has nothing to open while the payout is pending', () => {
        const { result } = renderHook(() =>
            useSwapPayoutCard({ scope: ETH, transactionId: undefined }),
        )

        expect(result.current).toEqual({
            isShown: true,
            isPending: true,
            label: 'transactions.common.swap_payout_on:Ethereum',
            handleOpen: undefined,
        })
    })

    it('is hidden when the payout is listed on a network with no explorer', () => {
        const { result } = renderHook(() =>
            useSwapPayoutCard({
                scope: { chainId: 'ethereum', networkId: 'custom' },
                transactionId: '0xpayout',
            }),
        )

        expect(result.current.isShown).toBe(false)
        expect(result.current.handleOpen).toBeUndefined()
    })
})
