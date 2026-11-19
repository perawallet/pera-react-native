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

import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useInitialsIcon } from '../useInitialsIcon'

describe('useInitialsIcon', () => {
    it('draws two initials for a two-word name at the md size and up', () => {
        const { result } = renderHook(() =>
            useInitialsIcon({ label: 'ZKsync Era', size: 40 }),
        )

        expect(result.current.initials).toBe('ZE')
    })

    it('draws a single initial in a circle smaller than md, such as a chip', () => {
        const { result } = renderHook(() =>
            useInitialsIcon({ label: 'ZKsync Era', size: 8 }),
        )

        expect(result.current.initials).toBe('Z')
    })

    it('draws one initial for a one-word name', () => {
        const { result } = renderHook(() =>
            useInitialsIcon({ label: 'Bitcoin', size: 40 }),
        )

        expect(result.current.initials).toBe('B')
    })
})
