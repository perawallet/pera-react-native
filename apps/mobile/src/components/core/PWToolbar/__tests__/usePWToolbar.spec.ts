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

import { act, renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { usePWToolbar } from '../usePWToolbar'

import type { LayoutChangeEvent } from 'react-native'

const layoutEvent = (width: number) =>
    ({ nativeEvent: { layout: { width } } }) as LayoutChangeEvent

describe('usePWToolbar', () => {
    it('reports the widest measured side and never shrinks below it', () => {
        const { result } = renderHook(() => usePWToolbar())

        expect(result.current.sideMinWidth).toBe(0)

        act(() => result.current.handleSideLayout(layoutEvent(24)))
        act(() => result.current.handleSideLayout(layoutEvent(60)))
        expect(result.current.sideMinWidth).toBe(60)

        // A narrower later measurement must not pull the min-width back down.
        act(() => result.current.handleSideLayout(layoutEvent(30)))
        expect(result.current.sideMinWidth).toBe(60)
    })
})
