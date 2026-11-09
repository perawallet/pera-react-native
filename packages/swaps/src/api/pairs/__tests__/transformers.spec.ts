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

import { describe, expect, test } from 'vitest'
import { swapAssetRefOf } from '../../router-ids'
import { transformSwapPairs } from '../transformers'
import { routerAsset, SCOPE_A, SCOPE_B } from '../../__tests__/routerFixtures'

describe('transformSwapPairs', () => {
    test('keeps readable token rows and drops deposit, fiat and unreadable ones', () => {
        const assets = transformSwapPairs(
            {
                results: [
                    { kind: 'token', asset: routerAsset(SCOPE_A, '31566704') },
                    {
                        kind: 'deposit',
                        asset: { asset_id: 'btc:main/slip44:0' },
                    },
                    { kind: 'fiat', asset: { asset_id: 'fiat:usd' } },
                    { kind: 'token', asset: routerAsset(SCOPE_B, 'usdc') },
                ],
            },
            swapAssetRefOf,
        )

        expect(assets.map(asset => asset.ref)).toEqual([
            { ...SCOPE_A, assetId: '31566704' },
        ])
    })
})
