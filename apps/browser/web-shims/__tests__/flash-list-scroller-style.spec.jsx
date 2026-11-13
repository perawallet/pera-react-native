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
// Unmocked react-native-web, unlike flash-list.spec.jsx: the question is which
// DOM node a list `style` lands on.
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { FlashList } from '../flash-list'

describe('@shopify/flash-list web shim scroller style', () => {
    it('puts a list style on the node that scrolls, not on a wrapper around it', () => {
        render(
            <FlashList
                data={['a']}
                renderItem={({ item }) => <span>{item}</span>}
                style={{ overscrollBehaviorY: 'none' }}
            />,
        )

        const scroller = screen.getByText('a').closest('[class]')
        let node = scroller
        while (
            node &&
            getComputedStyle(node).overflowY !== 'auto' &&
            getComputedStyle(node).overflowY !== 'scroll'
        ) {
            node = node.parentElement
        }

        expect(node).not.toBeNull()
        expect(getComputedStyle(node).overscrollBehaviorY).toBe('none')
    })
})
