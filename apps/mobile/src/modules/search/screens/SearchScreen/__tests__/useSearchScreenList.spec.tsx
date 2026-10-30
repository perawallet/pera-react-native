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

import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSearchScreenList } from '../useSearchScreenList'

const noop = () => {}

describe('useSearchScreenList', () => {
    it('keys a row by its key', () => {
        const { result } = renderHook(() =>
            useSearchScreenList({
                onAccountPress: noop,
                onContactPress: noop,
                onAssetPress: async () => {},
                onExpandSection: noop,
                chainId: 'algorand',
                value: 'pera',
                scopes: ['assets'],
            }),
        )

        expect(
            result.current.keyExtractor({
                type: 'section_header',
                kind: 'assets',
                key: 'section-assets',
            }),
        ).toBe('section-assets')
    })

    it('scrolls the list back to the top when the query changes', () => {
        const scrollToOffset = vi.fn()
        const props = {
            onAccountPress: noop,
            onContactPress: noop,
            onAssetPress: async () => {},
            onExpandSection: noop,
            chainId: 'algorand' as const,
            scopes: ['assets'] as never[],
            value: 'pera',
        }
        const { result, rerender } = renderHook(
            (current: typeof props) => useSearchScreenList(current),
            { initialProps: props },
        )
        result.current.listRef.current = { scrollToOffset } as never

        rerender({ ...props, value: 'algo' })

        expect(scrollToOffset).toHaveBeenCalledWith({
            offset: 0,
            animated: false,
        })
    })
})
