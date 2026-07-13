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

import { afterEach, describe, expect, it } from 'vitest'
import { getSurface } from '../surface'

describe('getSurface', () => {
    afterEach(() => {
        delete (globalThis as { __PERA_SURFACE__?: string }).__PERA_SURFACE__
    })

    it.each(['popup', 'expanded', 'approval'] as const)(
        'returns %s when the build-injected flag is set',
        surface => {
            ;(globalThis as { __PERA_SURFACE__?: string }).__PERA_SURFACE__ =
                surface
            expect(getSurface()).toBe(surface)
        },
    )

    it('falls back to expanded when the flag is missing', () => {
        expect(getSurface()).toBe('expanded')
    })

    it('falls back to expanded for unknown values', () => {
        ;(globalThis as { __PERA_SURFACE__?: string }).__PERA_SURFACE__ =
            'garbage'
        expect(getSurface()).toBe('expanded')
    })
})
