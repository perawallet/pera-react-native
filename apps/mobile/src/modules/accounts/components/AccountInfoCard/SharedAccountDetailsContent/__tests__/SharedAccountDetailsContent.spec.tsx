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
import { fireEvent, render, screen } from '@test-utils/render'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { SharedAccountDetailsContent } from '../SharedAccountDetailsContent'
import type { SharedAccountDetails } from '../../useAccountInfoCard'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, unknown>) => {
            if (params?.count != null) return `${key} (${String(params.count)})`
            return key
        },
    }),
}))

vi.mock('@components/AddressDisplay', () => ({
    AddressDisplay: ({
        address,
        testID,
    }: {
        address: string
        testID: string
    }) => <div data-testid={testID}>{address}</div>,
}))

vi.mock('@components/ParticipantCount', () => ({
    ParticipantCount: ({
        count,
        testID,
    }: {
        count: number
        testID: string
    }) => <span data-testid={testID}>{count}</span>,
}))

const details: SharedAccountDetails = {
    participantCount: 3,
    threshold: 2,
    addresses: ['ADDR_A', 'ADDR_B', 'ADDR_C'],
}

const renderWithId = (id = 'sheet-1') =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <SharedAccountDetailsContent details={details} />
        </BottomSheetIdContext.Provider>,
    )

describe('SharedAccountDetailsContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        vi.clearAllMocks()
    })

    it('renders threshold, participant count, and one row per address', () => {
        renderWithId()

        expect(
            screen.getByTestId('shared_account_details_content'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('shared_account_participant_count').textContent,
        ).toBe('3')
        expect(screen.getByTestId('shared_account_threshold').textContent).toBe(
            '2',
        )
        expect(
            screen.getByText('multisig.detail.accounts_title (3)'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('shared_account_participant_ADDR_A'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('shared_account_participant_ADDR_B'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('shared_account_participant_ADDR_C'),
        ).toBeTruthy()
    })

    it('cross icon dismisses (caller promise resolves with undefined)', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<void>({ id: 'sheet-1', contents: null })
        renderWithId('sheet-1')

        fireEvent.click(screen.getByTestId('icon-cross'))

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBeUndefined()
    })
})
