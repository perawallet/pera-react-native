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
import type {
    ChainDescriptor,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import {
    BASE,
    ETHEREUM,
    POLYGON,
    evmScopeOf,
} from '@packages/chain-ethereum/src/__tests__/evm-chains'
import { useTransactionDetailLayout } from '../useTransactionDetailLayout'

const mockPushWebView = vi.fn()

vi.mock('@modules/webview', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, string>) =>
            params ? `${key}:${params.explorer}` : key,
    }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    getChainDescriptor: vi.fn(),
}))

const ALGORAND_SCOPE: ChainScope = {
    chainId: 'algorand',
    networkId: 'mainnet',
}
const TX = '0xabc'

const peraExplorerDescriptor = {
    explorer: {
        name: 'Pera Explorer',
        transactionUrl: (networkId: string, id: string) =>
            networkId === 'custom'
                ? undefined
                : `https://explorer.perawallet.app/tx/${id}`,
    },
} as unknown as ChainDescriptor

describe('useTransactionDetailLayout', () => {
    beforeEach(() => {
        mockPushWebView.mockReset()
        vi.mocked(getChainDescriptor).mockImplementation(chainId => {
            if (chainId === 'algorand') return peraExplorerDescriptor
            const chain = [ETHEREUM, BASE, POLYGON].find(
                ({ row }) => row.id === chainId,
            )
            if (!chain) throw new Error(`no descriptor for ${chainId}`)
            return chain.descriptor
        })
    })

    it('Given an Algorand transaction, when the explorer opens, then it is Pera Explorer', () => {
        const { result } = renderHook(() =>
            useTransactionDetailLayout(ALGORAND_SCOPE, 'ALGOTX'),
        )

        result.current.handleOpenExplorer?.()

        expect(result.current.explorerLabel).toBe(
            'transactions.common.view_in_explorer:Pera Explorer',
        )
        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://explorer.perawallet.app/tx/ALGOTX',
        })
    })

    it.each([
        [ETHEREUM, 'Etherscan', 'https://etherscan.io/tx/0xabc'],
        [BASE, 'Basescan', 'https://basescan.org/tx/0xabc'],
        [POLYGON, 'Polygonscan', 'https://polygonscan.com/tx/0xabc'],
    ])(
        "Given a transaction on %#, when the explorer opens, then it is that chain's public explorer, never Pera Explorer",
        (chain, explorerName, url) => {
            const { result } = renderHook(() =>
                useTransactionDetailLayout(evmScopeOf(chain), TX),
            )

            result.current.handleOpenExplorer?.()

            expect(result.current.explorerLabel).toBe(
                `transactions.common.view_in_explorer:${explorerName}`,
            )
            expect(mockPushWebView).toHaveBeenCalledWith({ url })
        },
    )

    it("Given a testnet transaction, when the explorer opens, then it is the chain's testnet explorer", () => {
        const { result } = renderHook(() =>
            useTransactionDetailLayout(evmScopeOf(BASE, 'testnet'), TX),
        )

        result.current.handleOpenExplorer?.()

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://sepolia.basescan.org/tx/0xabc',
        })
    })

    it('Given a network with no explorer, then there is nothing to open', () => {
        const { result } = renderHook(() =>
            useTransactionDetailLayout(
                { chainId: 'algorand', networkId: 'custom' },
                'ALGOTX',
            ),
        )

        expect(result.current.handleOpenExplorer).toBeUndefined()
    })

    it('Given an unsigned transaction, then there is nothing to open', () => {
        const { result } = renderHook(() =>
            useTransactionDetailLayout(ALGORAND_SCOPE, undefined),
        )

        expect(result.current.handleOpenExplorer).toBeUndefined()
        expect(mockPushWebView).not.toHaveBeenCalled()
    })
})
