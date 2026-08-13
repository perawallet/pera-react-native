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

import React from 'react'
import { fireEvent, render, screen } from '@test-utils/render'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Linking } from 'react-native'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { SigningCompletedContent } from '../SigningCompletedContent'

describe('SigningCompletedContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        useBottomSheetStore.getState().registerBottomSheetHost()
        vi.clearAllMocks()
    })

    it('shows only Done when the session has no browser origin', () => {
        render(
            <BottomSheetIdContext.Provider value='sheet-1'>
                <SigningCompletedContent isTransaction />
            </BottomSheetIdContext.Provider>,
        )

        expect(screen.getByText('common.done')).toBeTruthy()
        expect(
            screen.queryByText(
                'walletconnect.request.success_sheet_return_to_dapp',
            ),
        ).toBeNull()
    })

    it('offers Return to the dApp for a browser-originated session and resolves the sheet on tap', async () => {
        vi.mocked(Linking.openURL).mockResolvedValue(true)
        const promise = useBottomSheetStore
            .getState()
            .request<boolean>({ id: 'sheet-1', contents: null })

        render(
            <BottomSheetIdContext.Provider value='sheet-1'>
                <SigningCompletedContent
                    isTransaction
                    returnToDapp={{
                        browserName: 'Chrome',
                        dappName: 'TestDApp',
                    }}
                />
            </BottomSheetIdContext.Provider>,
        )

        expect(screen.getByText('common.done')).toBeTruthy()
        fireEvent.click(
            screen.getByText(
                'walletconnect.request.success_sheet_return_to_dapp',
            ),
        )

        expect(Linking.openURL).toHaveBeenCalledWith(
            'googlechrome://',
        )
        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBe(true)
    })

    it('hides the CTA when the browser has no focus scheme (iOS Safari)', () => {
        render(
            <BottomSheetIdContext.Provider value='sheet-1'>
                <SigningCompletedContent
                    isTransaction
                    returnToDapp={{ browserName: 'Mobile Safari' }}
                />
            </BottomSheetIdContext.Provider>,
        )

        expect(
            screen.queryByText(
                'walletconnect.request.success_sheet_return_to_dapp',
            ),
        ).toBeNull()
        expect(screen.getByText('common.done')).toBeTruthy()
    })
})
