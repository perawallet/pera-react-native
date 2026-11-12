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

import { describe, expect, it } from 'vitest'
import { nativeAssetFor } from '@perawallet/wallet-core-assets'
import { discoverPathTarget } from '../discoverPathTarget'

describe('discoverPathTarget', () => {
    it.each([undefined, '', 'main/home', '/main/home'])(
        'maps %j to home',
        path => {
            expect(discoverPathTarget(path)).toEqual({ kind: 'home' })
        },
    )

    it.each(['token-detail/ALGO', '/token-detail/ALGO?x=1'])(
        'maps %s to the native Algorand asset',
        path => {
            expect(discoverPathTarget(path)).toEqual({
                kind: 'asset',
                assetId: nativeAssetFor('algorand').assetId,
                chainId: 'algorand',
            })
        },
    )

    it('maps a numeric token-detail path to that asset id', () => {
        expect(discoverPathTarget('token-detail/31566704')).toEqual({
            kind: 'asset',
            assetId: '31566704',
            chainId: 'algorand',
        })
    })

    it.each(['main/game', 'news/12', '/test'])(
        'maps %s to the WebView with the original path',
        path => {
            expect(discoverPathTarget(path)).toEqual({ kind: 'webview', path })
        },
    )
})
