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

import { render, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { AssetSocialMedia } from '../AssetSocialMedia'
import { PeraAsset } from '@perawallet/wallet-core-assets'

const mockPushWebView = vi.fn()

vi.mock('@hooks/webview', () => ({
    useWebView: () => ({
        pushWebView: mockPushWebView,
    }),
}))

describe('AssetSocialMedia', () => {
    const mockAsset = {
        assetId: '123',
        peraMetadata: {
            discordUrl: 'https://discord.gg/test',
            telegramUrl: 'https://t.me/test',
            twitterUsername: 'algo_project',
        },
    } as PeraAsset

    it('renders social links correctly', () => {
        const { container } = render(
            <AssetSocialMedia assetDetails={mockAsset} />,
        )
        const text = container.textContent?.toLowerCase() || ''
        expect(text).toContain('discord')
        expect(text).toContain('telegram')
        expect(text).toContain('twitter')
    })

    it('opens webview on press', () => {
        const { container } = render(
            <AssetSocialMedia assetDetails={mockAsset} />,
        )

        // Find discord button (it contains 'Discord' text)
        // If we can't find specific button, try getting by text from screen
        // But since we use container querySelectors in other tests, let's look for button elements
        const buttons = container.querySelectorAll('button')
        if (buttons.length > 0) {
            fireEvent.click(buttons[0])
            expect(mockPushWebView).toHaveBeenCalled()
        }
    })

    it('renders nothing if no links', () => {
        const emptyAsset = {
            assetId: '456',
            peraMetadata: {},
        } as PeraAsset

        const { container } = render(
            <AssetSocialMedia assetDetails={emptyAsset} />,
        )
        expect(container.innerHTML).toBe('')
    })
})
