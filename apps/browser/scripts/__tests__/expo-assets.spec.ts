// @vitest-environment node
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

import {
    findMissingAssetReferences,
    findUnreferencedScaleVariants,
    vendorAssetPath,
} from '../expo-assets.mjs'

const HERO = 'assets/assets/images/hero.0a1b'

// The module Expo's web asset transformer emits for an image, minified.
const assetModule = (assetPath: string) =>
    `m.exports={uri:"/${assetPath}",width:24,height:24,toString(){return this.uri}}`

describe('findUnreferencedScaleVariants', () => {
    it('returns the variants of a 1x file the bundle references', () => {
        const paths = [
            `${HERO}.png`,
            `${HERO}@2x.png`,
            `${HERO}@3x.png`,
            `${HERO}@1.5x.png`,
        ]

        const variants = findUnreferencedScaleVariants(
            paths,
            assetModule(`${HERO}.png`),
        )

        expect(variants).toEqual([
            `${HERO}@2x.png`,
            `${HERO}@3x.png`,
            `${HERO}@1.5x.png`,
        ])
    })

    it('keeps a variant the bundle references by its own path', () => {
        const uiCode = [
            assetModule(`${HERO}.png`),
            assetModule(`${HERO}@2x.png`),
        ].join(';')

        const variants = findUnreferencedScaleVariants(
            [`${HERO}.png`, `${HERO}@2x.png`, `${HERO}@3x.png`],
            uiCode,
        )

        expect(variants).toEqual([`${HERO}@3x.png`])
    })

    // A registry-style export builds each URL at runtime from a location, a
    // name and a scale, so no full path appears and every variant may load.
    it('keeps every variant when the 1x path is not in the bundle', () => {
        const uiCode =
            'registerAsset({httpServerLocation:"/assets/assets/images",name:"hero.0a1b",scales:[1,2,3],type:"png"})'

        const variants = findUnreferencedScaleVariants(
            [`${HERO}.png`, `${HERO}@2x.png`, `${HERO}@3x.png`],
            uiCode,
        )

        expect(variants).toEqual([])
    })

    it('leaves files without a scale suffix alone', () => {
        const variants = findUnreferencedScaleVariants(
            ['assets/assets/images/email@pera.png', `${HERO}.png`],
            assetModule(`${HERO}.png`),
        )

        expect(variants).toEqual([])
    })
})

describe('findMissingAssetReferences', () => {
    it('returns referenced asset paths that dist lacks', () => {
        const uiCode = [
            assetModule(`${HERO}.png`),
            "m.exports={uri:'/assets/assets/images/gone.ff.png'}",
        ].join(';')

        expect(findMissingAssetReferences(uiCode, [`${HERO}.png`])).toEqual([
            'assets/assets/images/gone.ff.png',
        ])
    })

    it('passes when every referenced asset is present', () => {
        expect(
            findMissingAssetReferences(assetModule(`${HERO}.png`), [
                `${HERO}.png`,
                `${HERO}@2x.png`,
            ]),
        ).toEqual([])
    })

    it('ignores remote URLs that happen to contain /assets/', () => {
        const uiCode = 'fetch("https://cdn.example.com/assets/logo.png")'

        expect(findMissingAssetReferences(uiCode, [])).toEqual([])
    })
})

describe('vendorAssetPath', () => {
    it('drops the pnpm store directory from a package asset', () => {
        expect(
            vendorAssetPath(
                'assets/__node_modules/.pnpm/@react-navigation+elements@2.9.43_react-native@0.86.2_0c1e/node_modules/@react-navigation/elements/lib/module/assets/back-icon.35ba.png',
            ),
        ).toBe(
            'assets/vendor/@react-navigation/elements/lib/module/assets/back-icon.35ba.png',
        )
    })

    it('handles an unscoped package', () => {
        expect(
            vendorAssetPath(
                'assets/__node_modules/.pnpm/react-native-web@0.21.3/node_modules/react-native-web/dist/icon.ab.png',
            ),
        ).toBe('assets/vendor/react-native-web/dist/icon.ab.png')
    })

    it('leaves app assets alone', () => {
        expect(vendorAssetPath('assets/assets/images/hero.0a1b.png')).toBe(null)
    })
})
