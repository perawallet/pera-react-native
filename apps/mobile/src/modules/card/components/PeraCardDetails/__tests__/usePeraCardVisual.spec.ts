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

import { renderHook } from '@test-utils/render'
import { act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { usePeraCardVisual } from '../usePeraCardVisual'

const SECURE_URL = 'https://secure/card.png'

describe('usePeraCardVisual', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('mounts the secure image on the back face when a URL is provided', () => {
        const { result } = renderHook(() =>
            usePeraCardVisual({ secureImageUrl: SECURE_URL }),
        )

        expect(result.current.backImageUrl).toBe(SECURE_URL)
    })

    it('forwards the back image load to the parent', () => {
        const onSecureImageLoad = vi.fn()
        const { result } = renderHook(() =>
            usePeraCardVisual({
                secureImageUrl: SECURE_URL,
                onSecureImageLoad,
            }),
        )

        act(() => {
            result.current.onBackImageLoad()
        })

        expect(onSecureImageLoad).toHaveBeenCalledTimes(1)
    })

    it('keeps the back face mounted through the flip-back, then unmounts it', () => {
        vi.useFakeTimers()
        const { result, rerender } = renderHook(
            ({ url }: { url?: string }) =>
                usePeraCardVisual({ secureImageUrl: url }),
            { initialProps: { url: SECURE_URL as string | undefined } },
        )
        expect(result.current.backImageUrl).toBe(SECURE_URL)

        // Hiding clears the URL, but the secure face must linger while the card
        // animates closed so the flip-back has something to show.
        rerender({ url: undefined })
        expect(result.current.backImageUrl).toBe(SECURE_URL)

        act(() => {
            vi.advanceTimersByTime(500)
        })
        expect(result.current.backImageUrl).toBeNull()
    })
})
