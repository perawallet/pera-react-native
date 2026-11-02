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
import { act, renderHook } from '@testing-library/react'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useAssetVerificationCard } from '../useAssetVerificationCard'

const mocks = vi.hoisted(() => ({ pushWebView: vi.fn() }))

vi.mock('@modules/webview/hooks/useWebViewStore', () => ({
    useWebView: () => ({ pushWebView: mocks.pushWebView }),
}))

const mockT = vi.hoisted(() => vi.fn((key: string) => key))
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: mockT }),
}))

const scope = { chainId: 'algorand' } as ChainScope

const asset = (
    verificationTier?: 'verified' | 'suspicious',
    assetId = '31566704',
): PeraAsset =>
    ({
        assetId,
        peraMetadata: verificationTier ? { verificationTier } : undefined,
    }) as PeraAsset

describe('useAssetVerificationCard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('hides the card for an asset with no verification tier', () => {
        const { result } = renderHook(() =>
            useAssetVerificationCard({ asset: asset(), scope }),
        )

        expect(result.current.isVisible).toBe(false)
    })

    it('shows the verified card for a verified asset', () => {
        const { result } = renderHook(() =>
            useAssetVerificationCard({ asset: asset('verified'), scope }),
        )

        expect(result.current.isVisible).toBe(true)
        expect(result.current.cardConfig.title).toBe(
            'asset_details.verification_card.verified_title',
        )
    })

    it('opens the verification guide when the learn-more link is pressed', () => {
        const { result } = renderHook(() =>
            useAssetVerificationCard({ asset: asset('verified'), scope }),
        )

        act(() => result.current.handleLearnMore())

        expect(mocks.pushWebView).toHaveBeenCalledWith({
            url: expect.any(String),
        })
    })
})
