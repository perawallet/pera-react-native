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
import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import type { AssetAboutDisplay } from '@modules/assets/types/asset-details-display'
import { useAssetAbout } from '../useAssetAbout'

const { mockPushWebView } = vi.hoisted(() => ({ mockPushWebView: vi.fn() }))

vi.mock('@modules/webview', async () => ({
    ...(await vi.importActual<
        typeof import('@modules/webview/hooks/handlers-shared')
    >('@modules/webview/hooks/handlers-shared')),
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: vi.fn(), readText: vi.fn() }),
}))

vi.mock('@hooks/useResolvedAddress', () => ({
    useResolvedAddress: () => ({ displayName: 'CREATOR' }),
}))

const makeAsset = (
    url: string | undefined,
    projectUrl: string | undefined,
): PeraAsset =>
    ({
        assetId: '1',
        name: 'Asset',
        url,
        peraMetadata: { projectUrl },
    }) as unknown as PeraAsset

const makeAbout = (explorerUrl: string | null): AssetAboutDisplay => ({
    idLabelKey: null,
    urlLabelKey: i18nKey('asset_details.about.url'),
    explorerLink: explorerUrl ? { url: explorerUrl, label: 'Explorer' } : null,
})

describe('useAssetAbout', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it.each(['http://asset.example', 'ipfs://bafybeigdyrzt'])(
        'offers no URL, explorer or project row for %s',
        url => {
            const { result } = renderHook(() =>
                useAssetAbout(makeAsset(url, url), makeAbout(url)),
            )

            expect(result.current.assetLink).toBeNull()
            expect(result.current.explorerLink).toBeNull()
            expect(result.current.projectUrl).toBeNull()
        },
    )

    it('keeps every row for https URLs and opens them in the webview', () => {
        const { result } = renderHook(() =>
            useAssetAbout(
                makeAsset(
                    'https://asset.example/info',
                    'https://project.example',
                ),
                makeAbout('https://explorer.example/asset/1'),
            ),
        )

        expect(result.current.assetLink).toEqual({
            url: 'https://asset.example/info',
            label: 'asset.example',
        })
        expect(result.current.explorerLink).toEqual({
            url: 'https://explorer.example/asset/1',
            label: 'Explorer',
        })
        expect(result.current.projectUrl).toBe('https://project.example')

        result.current.openLink('https://project.example')

        expect(mockPushWebView).toHaveBeenCalledWith(
            expect.objectContaining({ url: 'https://project.example' }),
        )
    })
})
