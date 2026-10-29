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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import { useAssetSocialMedia } from '../useAssetSocialMedia'

const { mockPushWebView } = vi.hoisted(() => ({ mockPushWebView: vi.fn() }))

vi.mock('@modules/webview', async () => ({
    ...(await vi.importActual<
        typeof import('@modules/webview/hooks/handlers-shared')
    >('@modules/webview/hooks/handlers-shared')),
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

const makeAsset = (peraMetadata: Record<string, unknown>): PeraAsset =>
    ({ assetId: '1', peraMetadata }) as unknown as PeraAsset

describe('useAssetSocialMedia', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('drops http and ipfs:// links and keeps https ones', () => {
        const { result } = renderHook(() =>
            useAssetSocialMedia(
                makeAsset({
                    discordUrl: 'http://discord.example/invite',
                    telegramUrl: 'ipfs://bafybeigdyrzt',
                    twitterUsername: 'pera',
                }),
            ),
        )

        expect(result.current.socialLinks).toEqual([
            {
                label: 'Twitter',
                url: 'https://twitter.com/pera',
                icon: 'socials/twitter',
            },
        ])
    })

    it('offers no links when none pass the browser gate', () => {
        const { result } = renderHook(() =>
            useAssetSocialMedia(
                makeAsset({ discordUrl: 'http://discord.example/invite' }),
            ),
        )

        expect(result.current.socialLinks).toEqual([])
    })

    it('opens an https link in the webview', () => {
        const { result } = renderHook(() =>
            useAssetSocialMedia(
                makeAsset({ discordUrl: 'https://discord.example/invite' }),
            ),
        )

        result.current.openLink(result.current.socialLinks[0]!.url)

        expect(mockPushWebView).toHaveBeenCalledWith(
            expect.objectContaining({
                url: 'https://discord.example/invite',
            }),
        )
    })
})
