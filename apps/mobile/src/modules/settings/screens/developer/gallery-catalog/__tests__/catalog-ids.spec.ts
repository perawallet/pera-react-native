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

import { describe, it, expect } from 'vitest'
import { getScreenSections } from '../screens.catalog'
import { getSheetSections } from '../sheets.catalog'
import { getDialogSections } from '../dialogs.catalog'

import type { GallerySection } from '../types'

const idsOf = (sections: GallerySection[]): string[] =>
    sections.flatMap(section => section.items.map(item => item.id))

const duplicatesOf = (ids: string[]): string[] => {
    const seen = new Set<string>()
    const dupes = new Set<string>()
    for (const id of ids) {
        if (seen.has(id)) dupes.add(id)
        seen.add(id)
    }
    return [...dupes].sort()
}

describe('gallery catalog ids', () => {
    // The locale tour writes screenshots to <device>/<locale>/<id>.png, so a
    // duplicate id silently overwrites another surface's capture.
    it('are unique across the tour-eligible categories', () => {
        const ids = [
            ...idsOf(getScreenSections()),
            ...idsOf(getSheetSections()),
            ...idsOf(getDialogSections()),
        ]

        expect(duplicatesOf(ids)).toEqual([])
    })

    it('cover at least the surfaces the tour was built against', () => {
        expect(idsOf(getScreenSections()).length).toBeGreaterThanOrEqual(101)
        expect(idsOf(getSheetSections()).length).toBeGreaterThanOrEqual(75)
    })
})
