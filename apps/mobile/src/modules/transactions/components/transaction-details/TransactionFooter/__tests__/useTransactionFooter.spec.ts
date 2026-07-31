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
import { type PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'

const mockPushWebView = vi.fn()

// Mutable so the `custom` case (explorerUrl: '' by design) is reachable
// per-test without re-mocking the module.
const { mockNetworkConfig } = vi.hoisted(() => ({
    mockNetworkConfig: { explorerUrl: 'https://explorer.test' },
}))

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual = (await importOriginal()) as Record<string, unknown>
    return {
        ...actual,
        useNetwork: () => ({ networkConfig: mockNetworkConfig }),
    }
})

vi.mock('@modules/webview/hooks', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useSingleAssetDetailsQuery: () => ({ data: undefined }),
}))

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
})
