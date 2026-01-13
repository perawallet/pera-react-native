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

import { vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    isIOS: vi.fn(),
}))

vi.mock('../../platform/utils', () => ({
    isIOS: mocks.isIOS,
}))

const loadFontFamilies = async (isOnIOS: boolean) => {
    vi.resetModules()
    mocks.isIOS.mockReturnValue(isOnIOS)
    const { fontFamilies } = await import('../fonts')
    return fontFamilies
}

describe('fontFamilies', () => {
    it('returns the expected font names on iOS', async () => {
        const fontFamilies = await loadFontFamilies(true)

        expect(fontFamilies.DMSANS[300]).toBe('DMSans-Light')
        expect(fontFamilies.DMSANS[400]).toBe('DMSans-Regular')
        expect(fontFamilies.DMSANS[500]).toBe('DMSans-Medium')
        expect(fontFamilies.DMSANS[700]).toBe('DMSans-Bold')

        expect(fontFamilies.DMMONO[300]).toBe('DMMono-Regular')
        expect(fontFamilies.DMMONO[500]).toBe('DMMono-Medium')
        expect(fontFamilies.DMMONO[700]).toBe('DMMono-Medium')
    })

    it('returns the expected font names on Android', async () => {
        const fontFamilies = await loadFontFamilies(false)

        expect(fontFamilies.DMSANS[300]).toBe('DMSansLight')
        expect(fontFamilies.DMSANS[400]).toBe('DMSansRegular')
        expect(fontFamilies.DMSANS[500]).toBe('DMSansMedium')
        expect(fontFamilies.DMSANS[700]).toBe('DMSansBold')

        expect(fontFamilies.DMMONO[300]).toBe('DMMonoRegular')
        expect(fontFamilies.DMMONO[500]).toBe('DMMonoRegular')
        expect(fontFamilies.DMMONO[700]).toBe('DMMonoRegular')
    })
})
