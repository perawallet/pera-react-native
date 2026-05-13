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

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@test-utils/render'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'

const { mockCopy } = vi.hoisted(() => ({
    mockCopy: vi.fn(),
}))

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mockCopy }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { LedgerAccountAddressContent } from '../LedgerAccountAddressContent'

const ADDRESS = '4WU2BYFAVWV33766FLYBEBVMDSCBYB2I5U257SGGHJ6FHFB3ZVDIVSHXLI'

const renderWithId = (id = 'sheet-1') =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <LedgerAccountAddressContent address={ADDRESS} />
        </BottomSheetIdContext.Provider>,
    )

describe('LedgerAccountAddressContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        vi.clearAllMocks()
    })

    it('renders the full address', () => {
        renderWithId()

        expect(screen.getByText(ADDRESS)).toBeTruthy()
    })

    it('copies the address when the copy button is pressed', () => {
        renderWithId()

        fireEvent.click(screen.getByText('common.copy_address'))

        expect(mockCopy).toHaveBeenCalledWith(ADDRESS)
    })
})
