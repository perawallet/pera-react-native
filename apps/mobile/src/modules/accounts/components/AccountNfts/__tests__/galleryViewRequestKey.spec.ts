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
import { galleryViewRequestKey } from '../useGalleryScrollReset'

const REQUEST = {
    addresses: ['0xA'],
    selectedChainId: null,
    sortMode: 'titleAsc',
    search: '',
    showOptedIn: false,
    showSuspicious: false,
    showHidden: false,
    acquisitionOrderSize: 0,
} as const

describe('galleryViewRequestKey', () => {
    it('changes with anything that reorders or narrows the gallery', () => {
        const base = galleryViewRequestKey(REQUEST)

        expect(
            [
                { selectedChainId: 'ethereum' as const },
                { sortMode: 'titleDesc' as const },
                { search: 'ape' },
                { showHidden: true },
                { addresses: ['0xB'] },
            ].map(change => galleryViewRequestKey({ ...REQUEST, ...change })),
        ).not.toContain(base)
    })

    it('follows the acquisition order only while the gallery sorts by it', () => {
        expect(
            galleryViewRequestKey({ ...REQUEST, acquisitionOrderSize: 3 }),
        ).toBe(galleryViewRequestKey(REQUEST))
        expect(
            galleryViewRequestKey({
                ...REQUEST,
                sortMode: 'recentlyAdded',
                acquisitionOrderSize: 3,
            }),
        ).not.toBe(
            galleryViewRequestKey({ ...REQUEST, sortMode: 'recentlyAdded' }),
        )
    })
})
