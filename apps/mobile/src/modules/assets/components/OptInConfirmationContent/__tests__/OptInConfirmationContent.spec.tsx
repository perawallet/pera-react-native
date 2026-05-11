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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, screen } from '@test-utils/render'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { OptInConfirmationContent } from '../OptInConfirmationContent'

const mockCopyToClipboard = vi.fn()

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({
        copyToClipboard: mockCopyToClipboard,
    }),
}))

vi.mock('@perawallet/wallet-core-assets', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-assets')
    >('@perawallet/wallet-core-assets')
    return {
        ...actual,
        useAssetsQuery: () => ({
            data: new Map([
                [
                    '2586029159',
                    {
                        assetId: '2586029159',
                        name: '$WILLOW',
                        unitName: 'WILLOW',
                        decimals: 6,
                        peraMetadata: {
                            verificationTier: 'verified',
                            isFavorited: false,
                        },
                    },
                ],
            ]),
        }),
    }
})

const baseProps = {
    assetId: '2586029159',
    accountAddress:
        'DUGTEGP3UHOZD5SRPVAAW2VVOFOTRVYNMZ5ASVXZI675WWKQZQ5W37QWG4',
}

const renderWithId = (id = 'sheet-1') =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <OptInConfirmationContent {...baseProps} />
        </BottomSheetIdContext.Provider>,
    )

describe('OptInConfirmationContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        vi.clearAllMocks()
    })

    it('renders asset name, unit name, and asset id', () => {
        renderWithId()

        expect(screen.getByText('$WILLOW')).toBeTruthy()
        expect(screen.getByText('WILLOW')).toBeTruthy()
        expect(screen.getByText('2586029159')).toBeTruthy()
    })

    it('resolves the caller promise with "confirm" when Approve is pressed', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<'confirm'>({ id: 'sheet-1', contents: null })
        renderWithId('sheet-1')

        fireEvent.click(screen.getByTestId('opt_in_confirm'))

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBe('confirm')
    })

    it('dismisses (resolves with undefined) when Close is pressed', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<'confirm'>({ id: 'sheet-1', contents: null })
        renderWithId('sheet-1')

        fireEvent.click(screen.getByTestId('opt_in_cancel'))

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBeUndefined()
    })

    it('copies the asset id when Copy ID is pressed', () => {
        renderWithId()

        fireEvent.click(screen.getByTestId('opt_in_copy_id'))

        expect(mockCopyToClipboard).toHaveBeenCalledWith('2586029159')
    })
})
