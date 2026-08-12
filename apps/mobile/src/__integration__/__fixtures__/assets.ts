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

// Asset fixtures shared across integration tests. Add named scenarios
// here rather than inlining ad-hoc shapes — they should describe the
// shape (e.g. USDC_LIKE, A_DECORATIVE_NFT) and be reusable.

import { Decimal } from 'decimal.js'
import {
    PeraAssetType,
    PeraAssetVerificationTier,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'

// USDC-like fungible asset: 6 decimals, large supply, verified. The
// real testnet USDC id is 10458941; mainnet is 31566704. The id below
// is fixture-only — pick something distinctive so handler responses
// don't accidentally match.
export const USDC_TEST_ASSET_ID = '99999990'

export const USDC_TEST_ASSET: PeraAsset = {
    assetId: USDC_TEST_ASSET_ID,
    name: 'Test Stablecoin',
    unitName: 'tUSD',
    decimals: 6,
    creator: { address: 'CREATOR_TEST_ADDRESS' },
    totalSupply: new Decimal('1000000000000'),
    peraMetadata: {
        isDeleted: false,
        verificationTier: PeraAssetVerificationTier.verified,
        isFavorited: false,
        isPriceAlertEnabled: false,
        type: PeraAssetType.standard_asset,
    },
}

// NFT-like collectible: decimals=0, supply=1, peraMetadata flags it as
// a collectible. The detail screen's `useCollectibleDetail` keys off
// `peraMetadata.collectible` to render the NFT layout.
export const NFT_TEST_ASSET_ID = '88888880'

export const NFT_TEST_ASSET: PeraAsset = {
    assetId: NFT_TEST_ASSET_ID,
    name: 'Test Collectible #1',
    unitName: 'TEST',
    decimals: 0,
    creator: { address: 'CREATOR_TEST_ADDRESS' },
    totalSupply: new Decimal('1'),
    url: 'https://example.test/nft-image.png',
    peraMetadata: {
        isDeleted: false,
        verificationTier: PeraAssetVerificationTier.verified,
        isFavorited: false,
        isPriceAlertEnabled: false,
        type: PeraAssetType.collectible,
        logo: 'https://example.test/nft-image.png',
    },
}

// Second collectible for ordering scenarios. Higher asset id than
// NFT_TEST_ASSET but alphabetically FIRST ('Another' < 'Test'), so the
// asset-id, title, and opt-in-round orderings are all pairwise distinct.
export const NFT_TEST_ASSET_2_ID = '88888881'

export const NFT_TEST_ASSET_2: PeraAsset = {
    assetId: NFT_TEST_ASSET_2_ID,
    name: 'Another Collectible',
    unitName: 'TEST2',
    decimals: 0,
    creator: { address: 'CREATOR_TEST_ADDRESS' },
    totalSupply: new Decimal('1'),
    url: 'https://example.test/nft-image-2.png',
    peraMetadata: {
        isDeleted: false,
        verificationTier: PeraAssetVerificationTier.verified,
        isFavorited: false,
        isPriceAlertEnabled: false,
        type: PeraAssetType.collectible,
        logo: 'https://example.test/nft-image-2.png',
    },
}
