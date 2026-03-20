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

import { describe, it, expect } from 'vitest'
import { getFontInjectionJS } from '../injected-scripts'

describe('getFontInjectionJS', () => {
    describe('iOS', () => {
        const result = getFontInjectionJS('ios')

        it('uses local() font sources', () => {
            expect(result).toContain("local('DMSans-Regular')")
            expect(result).toContain("local('DMSans-Medium')")
            expect(result).toContain("local('DMSans-SemiBold')")
            expect(result).toContain("local('DMSans-Bold')")
            expect(result).toContain("local('DMMono-Regular')")
            expect(result).toContain("local('DMMono-Medium')")
        })

        it('does not reference android asset files', () => {
            expect(result).not.toContain('file:///android_asset')
        })
    })

    describe('Android', () => {
        const result = getFontInjectionJS('android')

        it('uses file:///android_asset/ font URLs', () => {
            expect(result).toContain(
                'file:///android_asset/fonts/DMSansRegular.ttf',
            )
            expect(result).toContain(
                'file:///android_asset/fonts/DMSansMedium.ttf',
            )
            expect(result).toContain(
                'file:///android_asset/fonts/DMSansSemiBold.ttf',
            )
            expect(result).toContain(
                'file:///android_asset/fonts/DMSansBold.ttf',
            )
            expect(result).toContain(
                'file:///android_asset/fonts/DMMonoRegular.ttf',
            )
            expect(result).toContain(
                'file:///android_asset/fonts/DMMonoMedium.ttf',
            )
        })

        it('does not use local() font sources', () => {
            expect(result).not.toContain('local(')
        })
    })

    describe('both platforms', () => {
        const iosResult = getFontInjectionJS('ios')
        const androidResult = getFontInjectionJS('android')

        it('includes DM Sans body font override', () => {
            expect(iosResult).toContain("font-family:'DM Sans'")
            expect(androidResult).toContain("font-family:'DM Sans'")
        })

        it('includes DM Mono monospace override', () => {
            expect(iosResult).toContain("font-family:'DM Mono'")
            expect(androidResult).toContain("font-family:'DM Mono'")
        })

        it('includes all DM Sans font weights', () => {
            for (const weight of [400, 500, 600, 700]) {
                expect(iosResult).toContain(`font-weight:${weight}`)
                expect(androidResult).toContain(`font-weight:${weight}`)
            }
        })

        it('includes DM Mono font weights', () => {
            for (const weight of [400, 500]) {
                expect(iosResult).toContain(
                    `font-family:'DM Mono';font-weight:${weight}`,
                )
                expect(androidResult).toContain(
                    `font-family:'DM Mono';font-weight:${weight}`,
                )
            }
        })

        it('creates a style element and appends to head', () => {
            expect(iosResult).toContain("document.createElement('style')")
            expect(iosResult).toContain('head.appendChild(fontStyle)')
            expect(androidResult).toContain("document.createElement('style')")
            expect(androidResult).toContain('head.appendChild(fontStyle)')
        })
    })
})
