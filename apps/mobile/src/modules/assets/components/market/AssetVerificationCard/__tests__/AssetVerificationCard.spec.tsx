/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { render, fireEvent, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { AssetVerificationCard } from '../AssetVerificationCard'
import { PeraAsset, ALGO_ASSET_ID } from '@perawallet/wallet-core-assets'
import { config } from '@perawallet/wallet-core-config'

const mockPushWebView = vi.fn()

vi.mock('@modules/webview', () => ({
    useWebView: () => ({
        pushWebView: mockPushWebView,
    }),
}))

describe('AssetVerificationCard', () => {
    it('renders trusted card for ALGO asset', () => {
        const algoAsset = {
            assetId: ALGO_ASSET_ID,
            name: 'Algorand',
        } as PeraAsset

        const { container } = render(
            <AssetVerificationCard assetDetails={algoAsset} />,
        )
        expect(container).toBeTruthy()
        // Trusted content should be rendered
        expect(container.textContent?.toLowerCase()).toContain('trusted')
    })

    it('renders verified card for verified assets', () => {
        const verifiedAsset = {
            assetId: '12345',
            name: 'Verified Token',
            peraMetadata: {
                verificationTier: 'verified',
            },
        } as unknown as PeraAsset

        const { container } = render(
            <AssetVerificationCard assetDetails={verifiedAsset} />,
        )
        expect(container).toBeTruthy()
    })

    it('renders suspicious card for suspicious assets', () => {
        const suspiciousAsset = {
            assetId: '67890',
            name: 'Suspicious Token',
            peraMetadata: {
                verificationTier: 'suspicious',
            },
        } as unknown as PeraAsset

        const { container } = render(
            <AssetVerificationCard assetDetails={suspiciousAsset} />,
        )
        expect(container).toBeTruthy()
    })

    it('returns null for unverified assets', () => {
        const unverifiedAsset = {
            assetId: '11111',
            name: 'Random Token',
            peraMetadata: {
                verificationTier: 'unverified',
            },
        } as unknown as PeraAsset

        const { container } = render(
            <AssetVerificationCard assetDetails={unverifiedAsset} />,
        )
        // For unverified assets, the component returns null
        expect(container.innerHTML).toBe('')
    })

    it('opens ASA verification webview when learn more is pressed', () => {
        mockPushWebView.mockClear()
        const algoAsset = {
            assetId: ALGO_ASSET_ID,
            name: 'Algorand',
        } as PeraAsset

        render(<AssetVerificationCard assetDetails={algoAsset} />)
        fireEvent.click(
            screen.getByText('asset_details.verification_card.learn_more'),
        )
        expect(mockPushWebView).toHaveBeenCalledWith({
            url: config.asaVerificationUrl,
        })
    })
})
