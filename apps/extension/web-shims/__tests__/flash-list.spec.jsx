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

// Plain-JS spec (not .spec.tsx) deliberately — see react-native-pager-view's
// sibling spec for why: web-shims/ is untyped JS outside tsc's include glob.
import React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FlashList } from '../flash-list'

const flatListProps = vi.hoisted(() => ({ current: undefined }))

vi.mock('react-native', async () => {
    const actual = await vi.importActual('react-native')
    const ReactActual = await vi.importActual('react')
    return {
        ...actual,
        FlatList: ReactActual.forwardRef((props, ref) => {
            flatListProps.current = props
            return ReactActual.createElement('div', {
                ref,
                'data-testid': 'flat-list',
            })
        }),
    }
})

describe('@shopify/flash-list web shim', () => {
    beforeEach(() => {
        flatListProps.current = undefined
    })

    it('defaults onScrollToIndexFailed to a no-op so scrollToIndex without getItemLayout cannot throw', () => {
        render(<FlashList data={[]} renderItem={() => null} />)

        expect(flatListProps.current.onScrollToIndexFailed).toBeTypeOf(
            'function',
        )
        expect(() => flatListProps.current.onScrollToIndexFailed({})).not.toThrow()
    })

    it('lets a caller-supplied onScrollToIndexFailed override the default', () => {
        const custom = vi.fn()
        render(
            <FlashList
                data={[]}
                renderItem={() => null}
                onScrollToIndexFailed={custom}
            />,
        )

        expect(flatListProps.current.onScrollToIndexFailed).toBe(custom)
    })

    it('drops FlashList-only props FlatList does not understand', () => {
        render(
            <FlashList
                data={[]}
                renderItem={() => null}
                estimatedItemSize={50}
                overrideItemLayout={() => {}}
                drawDistance={100}
                masonry
                onLoad={() => {}}
            />,
        )

        expect(flatListProps.current.estimatedItemSize).toBeUndefined()
        expect(flatListProps.current.overrideItemLayout).toBeUndefined()
        expect(flatListProps.current.drawDistance).toBeUndefined()
        expect(flatListProps.current.masonry).toBeUndefined()
        expect(flatListProps.current.onLoad).toBeUndefined()
    })
})
