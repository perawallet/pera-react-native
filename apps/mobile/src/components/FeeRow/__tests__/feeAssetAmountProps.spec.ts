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

import { describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { nativeAssetFor, type PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { feeAssetAmountPropsOf } from '../feeAssetAmountProps'

vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-assets')
    >()),
    nativeAssetFor: vi.fn(),
}))

const SCOPE = {
    chainId: 'testchain',
    networkId: 'mainnet',
} as unknown as ChainScope
const NATIVE = {
    assetId: 'native',
    unitName: 'TKN',
    decimals: 6,
} as PeraAsset

describe('feeAssetAmountPropsOf', () => {
    it('turns base units into whole units of the native asset, shown to significant digits', () => {
        vi.mocked(nativeAssetFor).mockReturnValue(NATIVE)

        const props = feeAssetAmountPropsOf(SCOPE, new Decimal(458_000))

        expect(props).toMatchObject({
            chainId: 'testchain',
            asset: NATIVE,
            density: 'significant',
            symbolPosition: 'end',
            ignorePrivacyMode: true,
        })
        expect(props.value?.toString()).toBe('0.458')
    })
})
