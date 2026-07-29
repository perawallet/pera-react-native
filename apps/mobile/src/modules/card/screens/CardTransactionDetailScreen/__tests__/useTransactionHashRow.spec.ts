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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPushWebView = vi.fn()
const mockCopyToClipboard = vi.fn()

// Mutable, for the same reason as `mockCapabilities` below: `custom` has an
// empty explorerUrl by design, and that case needs to be reachable per-test.
const { mockNetworkConfig } = vi.hoisted(() => ({
    mockNetworkConfig: { explorerUrl: 'https://explorer.test' },
}))

vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-blockchain',
    )
    return {
        ...actual,
        useNetwork: () => ({ networkConfig: mockNetworkConfig }),
    }
})

vi.mock('@modules/webview/hooks', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({
        copyToClipboard: mockCopyToClipboard,
        readText: vi.fn(),
    }),
}))

const mockOpenURL = vi.fn()
vi.mock('react-native', async importOriginal => {
    const actual = await importOriginal<object>()
    return {
        ...actual,
        Linking: { openURL: (...args: unknown[]) => mockOpenURL(...args) },
    }
})

// Mutable capability map: mutate `mockCapabilities` per test to simulate the
// native-shaped (inAppWebView: true) and web-shaped (false) route capability
// maps without re-mocking.
const { mockCapabilities } = vi.hoisted(() => ({
    mockCapabilities: { inAppWebView: true },
}))

vi.mock('@routes/capabilities', () => ({
    routeCapabilities: mockCapabilities,
}))

import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useTransactionHashRow } from '../useTransactionHashRow'

const TX_HASH = 'H2KQF3YLVJZP4W6XNBTAM5RUE7DCGS2IK4LMOQ6PYAWBVXCZE3TR'

describe('useTransactionHashRow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Object.assign(mockCapabilities, { inAppWebView: true })
        Object.assign(mockNetworkConfig, {
            explorerUrl: 'https://explorer.test',
        })
    })

    it('derives the display hash through the shared middle-truncation util', () => {
        // The global unit setup mocks the util as identity; the exact "AB...YZ"
        // output is covered by the integration test and the util's own suite.
        const { result } = renderHook(() =>
            useTransactionHashRow(TX_HASH, 'algorand'),
        )

        expect(truncateAlgorandAddress).toHaveBeenCalledWith(TX_HASH, 12)
        expect(result.current.truncatedHash).toBe(
            vi.mocked(truncateAlgorandAddress).mock.results[0].value,
        )
    })

    it('opens the explorer transaction page in the in-app webview', () => {
        const { result } = renderHook(() =>
            useTransactionHashRow(TX_HASH, 'algorand'),
        )

        result.current.onOpenExplorer?.()

        expect(mockPushWebView).toHaveBeenCalledWith(
            expect.objectContaining({
                url: `https://explorer.test/tx/${TX_HASH}`,
            }),
        )
        expect(mockOpenURL).not.toHaveBeenCalled()
    })

    it('opens the explorer page in a browser tab when inAppWebView is off (web)', () => {
        Object.assign(mockCapabilities, { inAppWebView: false })
        const { result } = renderHook(() =>
            useTransactionHashRow(TX_HASH, 'algorand'),
        )

        result.current.onOpenExplorer?.()

        expect(mockOpenURL).toHaveBeenCalledWith(
            `https://explorer.test/tx/${TX_HASH}`,
        )
        expect(mockPushWebView).not.toHaveBeenCalled()
    })

    it('offers no explorer action for a non-Algorand funding leg', () => {
        const { result } = renderHook(() =>
            useTransactionHashRow('0xb92de09d893e', 'linea'),
        )

        expect(result.current.onOpenExplorer).toBeUndefined()
    })

    it('offers no explorer action on a network with no explorer', () => {
        // On `custom` this is the worst of the explorer sites: with
        // inAppWebView off it reaches Linking.openURL('/tx/…'), which rejects
        // rather than no-opping.
        Object.assign(mockNetworkConfig, { explorerUrl: '' })

        const { result } = renderHook(() =>
            useTransactionHashRow(TX_HASH, 'algorand'),
        )

        expect(result.current.onOpenExplorer).toBeUndefined()
    })

    it('copies the full (untruncated) hash', () => {
        const { result } = renderHook(() =>
            useTransactionHashRow(TX_HASH, 'algorand'),
        )

        result.current.onCopy()

        expect(mockCopyToClipboard).toHaveBeenCalledWith(TX_HASH)
    })
})
