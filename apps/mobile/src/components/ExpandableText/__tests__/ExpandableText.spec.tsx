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

import { describe, it, expect } from 'vitest'
import React from 'react'
import { render, fireEvent, screen } from '@test-utils/render'
import { ExpandableText } from '../ExpandableText'

describe('ExpandableText', () => {
    it('truncates text if it exceeds limit', () => {
        const text =
            'This is a long text that should be truncated because it exceeds the limit.'
        const limit = 10
        render(
            <ExpandableText
                text={text}
                limit={limit}
            />,
        )

        expect(screen.getByText('This is a ...')).toBeTruthy()
        expect(screen.getByText('Show more')).toBeTruthy()
    })

    it('expands text when clicking show more', () => {
        const text = 'This is a long text.'
        const limit = 5
        render(
            <ExpandableText
                text={text}
                limit={limit}
            />,
        )

        fireEvent.click(screen.getByText('Show more'))
        expect(screen.getByText(text)).toBeTruthy()
        expect(screen.getByText('Show less')).toBeTruthy()
    })
})
