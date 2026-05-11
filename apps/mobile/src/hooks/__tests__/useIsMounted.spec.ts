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

import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useIsMounted } from '../useIsMounted'

describe('useIsMounted', () => {
    it('returns true while the component is mounted', () => {
        const { result } = renderHook(() => useIsMounted())
        expect(result.current()).toBe(true)
    })

    it('returns false after the component unmounts', () => {
        const { result, unmount } = renderHook(() => useIsMounted())
        const isMounted = result.current
        unmount()
        expect(isMounted()).toBe(false)
    })

    it('returns a stable getter across re-renders', () => {
        const { result, rerender } = renderHook(() => useIsMounted())
        const first = result.current
        rerender()
        expect(result.current).toBe(first)
    })
})
