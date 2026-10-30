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

// @vitest-environment node

import { describe, expect, it } from 'vitest'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import type { AssetAboutDisplay } from '@modules/assets/types/asset-details-display'
import {
    getAssetAboutVisibility,
    type AssetAboutLinks,
} from '../getAssetAboutVisibility'

const asset = (overrides: Partial<PeraAsset> = {}): PeraAsset =>
    ({
        assetId: 'native',
        decimals: 18,
        creator: { address: '' },
        ...overrides,
    }) as PeraAsset

const about = (
    overrides: Partial<AssetAboutDisplay> = {},
): AssetAboutDisplay => ({
    idLabelKey: null,
    urlLabelKey: i18nKey('asset_details.about.url'),
    explorerLink: null,
    ...overrides,
})

const NO_LINKS: AssetAboutLinks = {
    assetLink: null,
    explorerLink: null,
    projectUrl: null,
}

describe('getAssetAboutVisibility', () => {
    it('hides the section when no row would render', () => {
        const visibility = getAssetAboutVisibility(asset(), about(), NO_LINKS)

        expect(visibility.isVisible).toBe(false)
    })

    it('shows the id and explorer rows of a token', () => {
        const visibility = getAssetAboutVisibility(
            asset({ assetId: '0xabc' }),
            about({
                idLabelKey: i18nKey('asset_details.collectible.contract'),
            }),
            {
                ...NO_LINKS,
                explorerLink: {
                    url: 'https://etherscan.io/x',
                    label: 'etherscan.io',
                },
            },
        )

        expect(visibility).toMatchObject({
            isVisible: true,
            hasIdRow: true,
            hasExplorerRow: true,
            hasCreatorRow: false,
            hasUrlRow: false,
            hasProjectWebsiteRow: false,
        })
    })

    it('shows the section for an explorer link alone', () => {
        const visibility = getAssetAboutVisibility(asset(), about(), {
            ...NO_LINKS,
            explorerLink: {
                url: 'https://algoscan.app/asset/0',
                label: 'Algoscan',
            },
        })

        expect(visibility.isVisible).toBe(true)
    })

    it('hides the section when the only link failed the browser gate', () => {
        const visibility = getAssetAboutVisibility(
            asset({ url: 'ipfs://unsafe' }),
            about({
                explorerLink: {
                    url: 'http://explorer.example',
                    label: 'explorer.example',
                },
            }),
            NO_LINKS,
        )

        expect(visibility.isVisible).toBe(false)
    })

    it('shows the creator, url and project website rows when the asset has them', () => {
        const visibility = getAssetAboutVisibility(
            asset({ creator: { address: 'CREATOR' } }),
            about(),
            {
                assetLink: {
                    url: 'https://asset.example',
                    label: 'asset.example',
                },
                explorerLink: null,
                projectUrl: 'https://project.example',
            },
        )

        expect(visibility).toMatchObject({
            isVisible: true,
            hasCreatorRow: true,
            hasUrlRow: true,
            hasProjectWebsiteRow: true,
        })
    })
})
