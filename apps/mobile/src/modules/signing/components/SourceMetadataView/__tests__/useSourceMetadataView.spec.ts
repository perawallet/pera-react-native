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
import { renderHook, act } from '@testing-library/react'
import {
    useProjectByUrlQuery,
    type PeraProject,
    type UseProjectByUrlQueryResult,
} from '@perawallet/wallet-core-projects'
import { useSourceMetadataView } from '../useSourceMetadataView'

// Keep the real `resolveDisplayableVerificationTier` so the trust logic runs;
// only the network lookup and the webview navigation are stubbed.
vi.mock('@perawallet/wallet-core-projects', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-projects')
    >()),
    useProjectByUrlQuery: vi.fn(),
}))

const mocks = vi.hoisted(() => ({ pushWebView: vi.fn() }))

vi.mock('@modules/webview/hooks', () => ({
    useWebView: () => ({ pushWebView: mocks.pushWebView }),
}))

const verifiedTinyman: PeraProject = {
    name: 'Tinyman',
    url: 'https://tinyman.org',
    verificationTier: 'verified',
}

// Only `data` is read by the hook; the rest of TanStack's UseQueryResult union
// isn't worth constructing.
const stubProjectQuery = (project: PeraProject) =>
    vi.mocked(useProjectByUrlQuery).mockReturnValue({
        data: project,
    } as unknown as UseProjectByUrlQueryResult)

describe('useSourceMetadataView — verified-badge gating', () => {
    it('suppresses the verified badge without a verifiedOrigin (WalletConnect)', () => {
        stubProjectQuery(verifiedTinyman)

        const { result } = renderHook(() =>
            useSourceMetadataView({
                name: 'Free Airdrop',
                url: 'https://tinyman.org',
            }),
        )

        expect(result.current.verificationTier).toBeUndefined()
    })

    it('shows the verified badge when a webview verifiedOrigin host-matches', () => {
        stubProjectQuery(verifiedTinyman)

        const { result } = renderHook(() =>
            useSourceMetadataView(
                { url: 'https://tinyman.org' },
                'https://tinyman.org',
            ),
        )

        expect(result.current.verificationTier).toBe('verified')
    })

    it('always surfaces a suspicious badge', () => {
        stubProjectQuery({ ...verifiedTinyman, verificationTier: 'suspicious' })

        const { result } = renderHook(() =>
            useSourceMetadataView({ url: 'https://tinyman.org' }),
        )

        expect(result.current.verificationTier).toBe('suspicious')
    })
})

describe('useSourceMetadataView — hostile peerMeta URL gating', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        stubProjectQuery({ url: '' } as PeraProject)
    })

    it.each([
        'javascript:alert(document.cookie)',
        'content://com.evil.provider/secret',
        'http://insecure.example',
    ])('does not open the WebView for %s', url => {
        const { result } = renderHook(() => useSourceMetadataView({ url }))

        act(() => result.current.handlePressUrl())

        expect(mocks.pushWebView).not.toHaveBeenCalled()
    })

    it('opens the WebView for a valid https peerMeta URL', () => {
        const { result } = renderHook(() =>
            useSourceMetadataView({ url: 'https://tinyman.org' }),
        )

        act(() => result.current.handlePressUrl())

        expect(mocks.pushWebView).toHaveBeenCalledWith({
            id: expect.any(String),
            url: 'https://tinyman.org',
        })
    })
})
