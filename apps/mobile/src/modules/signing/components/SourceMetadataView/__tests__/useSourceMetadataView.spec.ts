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

import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useProjectByUrlQuery } from '@perawallet/wallet-core-projects'
import { useSourceMetadataView } from '../useSourceMetadataView'

// Keep the real `resolveDisplayableVerificationTier` so the trust logic runs;
// only the network lookup and the webview navigation are stubbed.
vi.mock('@perawallet/wallet-core-projects', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-projects')
    >()),
    useProjectByUrlQuery: vi.fn(),
}))

vi.mock('@modules/webview/hooks', () => ({
    useWebView: () => ({ pushWebView: vi.fn() }),
}))

const verifiedTinyman = {
    name: 'Tinyman',
    url: 'https://tinyman.org',
    verificationTier: 'verified' as const,
}

describe('useSourceMetadataView — verified-badge gating (PERA-4715)', () => {
    it('suppresses the verified badge without a verifiedOrigin (WalletConnect)', () => {
        ;(useProjectByUrlQuery as any).mockReturnValue({
            data: verifiedTinyman,
        })

        const { result } = renderHook(() =>
            useSourceMetadataView({
                name: 'Free Airdrop',
                url: 'https://tinyman.org',
            }),
        )

        expect(result.current.verificationTier).toBeUndefined()
    })

    it('shows the verified badge when a webview verifiedOrigin host-matches', () => {
        ;(useProjectByUrlQuery as any).mockReturnValue({
            data: verifiedTinyman,
        })

        const { result } = renderHook(() =>
            useSourceMetadataView(
                { url: 'https://tinyman.org' },
                'https://tinyman.org',
            ),
        )

        expect(result.current.verificationTier).toBe('verified')
    })

    it('always surfaces a suspicious badge', () => {
        ;(useProjectByUrlQuery as any).mockReturnValue({
            data: { ...verifiedTinyman, verificationTier: 'suspicious' },
        })

        const { result } = renderHook(() =>
            useSourceMetadataView({ url: 'https://tinyman.org' }),
        )

        expect(result.current.verificationTier).toBe('suspicious')
    })
})
