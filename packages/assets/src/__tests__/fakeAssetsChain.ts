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

import { vi } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    type AssetRef,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { assetsChainAdapters, type AssetsChainAdapter } from '../chain-adapter'
import {
    DEFAULT_ASSET_METADATA,
    PeraAssetType,
    PeraAssetVerificationTier,
    type PeraAsset,
} from '../models'

// One instance, as the contract requires: consumers compare it by identity.
export const FAKE_NATIVE_ASSET: PeraAsset = {
    assetId: '0',
    name: 'Algo',
    unitName: 'ALGO',
    decimals: 6,
    totalSupply: new Decimal('10000000000000000'),
    creator: { address: '' },
    peraMetadata: {
        ...DEFAULT_ASSET_METADATA,
        verificationTier: PeraAssetVerificationTier.verified,
        type: PeraAssetType.algo,
    },
}

export const fakeAssetsAdapter = (
    overrides: Partial<AssetsChainAdapter> = {},
): AssetsChainAdapter => ({
    chainId: LEGACY_CHAIN_ID,
    priceProvider: 'pera',
    maxPriceIdsPerRequest: 100,
    getNativeAsset: () => FAKE_NATIVE_ASSET,
    syncAssets: vi.fn(async () => undefined),
    getAssetMetadata: vi.fn(async (ref: AssetRef) => ({
        ...FAKE_NATIVE_ASSET,
        assetId: ref.assetId,
    })),
    fetchOnChainAsset: vi.fn(async (ref: AssetRef) => ({
        ...FAKE_NATIVE_ASSET,
        assetId: ref.assetId,
    })),
    fetchAssetAuthorities: vi.fn(async () => ({
        hasFreeze: false,
        hasClawback: false,
        freezeAddress: null,
        clawbackAddress: null,
    })),
    search: vi.fn(async () => ({ results: [], nextCursor: undefined })),
    getPrices: vi.fn(async () => []),
    ...overrides,
})

export const registerFakeAssetsAdapter = (
    overrides: Partial<AssetsChainAdapter> = {},
): AssetsChainAdapter => {
    const adapter = fakeAssetsAdapter(overrides)
    assetsChainAdapters.reset()
    assetsChainAdapters.register(adapter)
    return adapter
}
