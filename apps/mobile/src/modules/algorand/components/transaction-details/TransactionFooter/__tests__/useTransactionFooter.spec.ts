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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const mockPushWebView = vi.fn()

// Mutable so the `custom` case (explorerUrl: '' by design) is reachable
// per-test without re-mocking the module.
const { mockNetworkConfig } = vi.hoisted(() => ({
    mockNetworkConfig: { explorerUrl: 'https://explorer.test' },
}))

vi.mock(
    '@perawallet/wallet-core-chain-algorand/blockchain',
    async importOriginal => ({
        ...(await importOriginal<
            typeof import('@perawallet/wallet-core-chain-algorand/blockchain')
        >()),
    }),
)

vi.mock('@perawallet/wallet-core-config', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-config')
    >()),
    getAlgorandChainConfig: () => mockNetworkConfig,
}))

vi.mock('@modules/webview/hooks/useWebViewStore', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useSingleAssetDetailsQuery: () => ({ data: undefined }),
}))

import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-chain-algorand/blockchain'
import { useTransactionFooter } from '../useTransactionFooter'

const makeTransaction = (): PeraDisplayableTransaction =>
    ({ id: 'TX_ID_123' }) as PeraDisplayableTransaction

describe('useTransactionFooter', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Object.assign(mockNetworkConfig, {
            explorerUrl: 'https://explorer.test',
        })
    })

    it('opens the explorer transaction page in the in-app webview', () => {
        const { result } = renderHook(() =>
            useTransactionFooter(makeTransaction()),
        )

        result.current.showInExplorer?.()

        expect(mockPushWebView).toHaveBeenCalledWith(
            expect.objectContaining({
                url: 'https://explorer.test/tx/TX_ID_123',
            }),
        )
    })

    it('offers no explorer action on a network with no explorer', () => {
        // `custom` has explorerUrl: '' by design, so interpolating it yields
        // the schemeless relative path '/tx/TX_ID_123'.
        Object.assign(mockNetworkConfig, { explorerUrl: '' })

        const { result } = renderHook(() =>
            useTransactionFooter(makeTransaction()),
        )

        expect(result.current.showInExplorer).toBeUndefined()
    })

    it('prefixes a scheme-less asset url so the webview can load it', () => {
        const { result } = renderHook(() =>
            useTransactionFooter({
                id: 'TX_ID_123',
                assetConfigTransaction: { params: { url: 'example.com/nft' } },
            } as PeraDisplayableTransaction),
        )

        expect(result.current.assetUrl).toBe('https://example.com/nft')
    })

    it.each(['http://example.com/nft', 'javascript:alert(1)'])(
        'hides the asset url CTA and pushes nothing for %s',
        url => {
            const { result } = renderHook(() =>
                useTransactionFooter({
                    id: 'TX_ID_123',
                    assetConfigTransaction: { params: { url } },
                } as PeraDisplayableTransaction),
            )

            result.current.showAssetUrl()

            expect(result.current.assetUrl).toBeNull()
            expect(mockPushWebView).not.toHaveBeenCalled()
        },
    )
})
