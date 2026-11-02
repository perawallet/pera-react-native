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

vi.mock(
    '@perawallet/wallet-core-chain-algorand/blockchain',
    async importOriginal => ({
        ...(await importOriginal<
            typeof import('@perawallet/wallet-core-chain-algorand/blockchain')
        >()),
    }),
)

vi.mock('@modules/webview/hooks/useWebViewStore', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useSingleAssetDetailsQuery: () => ({ data: undefined }),
}))

import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-chain-algorand/blockchain'
import { useTransactionFooter } from '../useTransactionFooter'

describe('useTransactionFooter', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it.each([
        [
            'an unsigned transaction with its raw form',
            { rawTransaction: {} },
            true,
        ],
        [
            'a confirmed transaction with no asset url',
            { id: 'TX_ID_123', rawTransaction: {} },
            false,
        ],
        [
            'a confirmed transaction with an asset url',
            {
                id: 'TX_ID_123',
                assetConfigTransaction: {
                    params: { url: 'https://example.com/nft' },
                },
            },
            true,
        ],
    ])(
        'has actions for %s only when there is something to show',
        (_label, fields, expected) => {
            const { result } = renderHook(() =>
                useTransactionFooter(fields as PeraDisplayableTransaction),
            )

            expect(result.current.hasActions).toBe(expected)
        },
    )

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
