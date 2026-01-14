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

import { render, screen, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import AssetSocialMedia from '../AssetSocialMedia'
import { PeraAsset } from '@perawallet/wallet-core-assets'

const mockPushWebView = vi.fn()
vi.mock('@providers/WebViewProvider', () => ({
    useWebView: () => ({
        pushWebView: mockPushWebView,
    }),
}))

const mockDetails = {
    peraMetadata: {
        website: 'https://test.com',
        twitterUsername: 'testtwitter',
        discordUrl: 'https://discord.gg/test',
        telegramUrl: 'https://t.me/test',
    },
} as unknown as PeraAsset

describe('AssetSocialMedia', () => {
    it('renders social links correctly', () => {
        render(<AssetSocialMedia assetDetails={mockDetails} />)
        
        expect(screen.getByText('asset_details.markets.social_media')).toBeTruthy()
        expect(screen.getByText('Discord')).toBeTruthy()
        expect(screen.getByText('Telegram')).toBeTruthy()
        expect(screen.getByText('Twitter')).toBeTruthy()
    })

    it('opens webview on press', () => {
        render(<AssetSocialMedia assetDetails={mockDetails} />)
        
        fireEvent.click(screen.getByText('Discord'))
        expect(mockPushWebView).toHaveBeenCalledWith(expect.objectContaining({
            url: 'https://discord.gg/test'
        }))
    })

    it('renders nothing if no links', () => {
        const { container } = render(<AssetSocialMedia assetDetails={{} as PeraAsset} />)
        expect(container.childElementCount).toBe(0)
    })
})
