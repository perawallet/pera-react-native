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

// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { setActiveLocale } from '../../utils/locale'
import { useActiveLocale } from '../useActiveLocale'

describe('useActiveLocale', () => {
    afterEach(() => {
        setActiveLocale('en')
    })

    it('returns the new locale after the app changes language', () => {
        const { result } = renderHook(() => useActiveLocale())
        expect(result.current).toBe('en')

        act(() => setActiveLocale('de'))

        expect(result.current).toBe('de')
    })
})
