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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FlashListProps } from '@shopify/flash-list'
import { render } from '@test-utils/render'
import { PWInBottomSheetContext } from '@components/core/PWBottomSheet/inSheetContext'
import { AccountPicker } from '../AccountPicker'

let capturedProps = {} as FlashListProps<unknown>
const mockScrollableCreator = vi.fn()

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
vi.mock('@shopify/flash-list', () => {
    const React = require('react')
    return {
        FlashList: (props: any) => {
            capturedProps = props
            return React.createElement('div')
        },
    }
})
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */

vi.mock('@gorhom/bottom-sheet', () => ({
    useBottomSheetScrollableCreator: () => mockScrollableCreator,
}))

const renderInSheet = (isEmbedded?: boolean) =>
    render(
        <PWInBottomSheetContext.Provider value={true}>
            <AccountPicker
                accounts={[]}
                onSelect={vi.fn()}
                isEmbedded={isEmbedded}
            />
        </PWInBottomSheetContext.Provider>,
    )

describe('AccountPicker', () => {
    beforeEach(() => {
        capturedProps = {} as FlashListProps<unknown>
    })

    it('scrolls as the sheet scrollable by default', () => {
        renderInSheet()

        expect(capturedProps.renderScrollComponent).toBe(mockScrollableCreator)
        expect(capturedProps.scrollEnabled).toBe(true)
    })

    it('leaves scrolling and sheet sizing to the parent when embedded', () => {
        renderInSheet(true)

        expect(capturedProps.renderScrollComponent).toBeUndefined()
        expect(capturedProps.scrollEnabled).toBe(false)
    })
})
