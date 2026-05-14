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
import { fireEvent, render, screen } from '@test-utils/render'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { StakingHelpContent } from '../StakingHelpContent'

vi.mock('@modules/webview', () => ({
    useWebView: vi.fn(() => ({
        pushWebView: vi.fn(),
    })),
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        algorandDefiUrl: 'https://algorand.co/ecosystem/defi',
    },
}))

const renderInSheet = () =>
    render(
        <BottomSheetIdContext.Provider value='sheet-1'>
            <StakingHelpContent />
        </BottomSheetIdContext.Provider>,
    )

describe('StakingHelpContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
    })

    it('renders all three staking type rows', () => {
        renderInSheet()

        expect(screen.getByText('staking.type_liquid')).toBeTruthy()
        expect(screen.getByText('staking.type_pools')).toBeTruthy()
        expect(screen.getByText('staking.type_delegated')).toBeTruthy()
    })

    it('renders the sheet title', () => {
        renderInSheet()
        expect(screen.getByText('staking.help.title')).toBeTruthy()
    })

    it('dismisses the host sheet when close icon is pressed', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request({ id: 'sheet-1', contents: null })
        renderInSheet()

        fireEvent.click(screen.getByTestId('staking-help-sheet-close'))

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBeUndefined()
    })
})
