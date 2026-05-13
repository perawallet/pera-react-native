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
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { ConnectionSuccessContent } from '../ConnectionSuccessContent'
import type { WalletConnectSessionRequest } from '@perawallet/wallet-core-walletconnect'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, opts?: Record<string, unknown>) =>
            opts ? `${key}:${JSON.stringify(opts)}` : key,
    }),
}))

vi.mock('@components/core', () => ({
    PWView: ({ children }: { children: React.ReactNode }) => (
        <div data-testid='PWView'>{children}</div>
    ),
    PWButton: ({ title, onPress }: { title: string; onPress: () => void }) => (
        <button onClick={onPress}>{title}</button>
    ),
    PWIcon: () => <div data-testid='PWIcon' />,
    PWText: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
}))

vi.mock('../styles', () => ({
    useStyles: () => ({
        container: {},
        icon: {},
        message: {},
    }),
}))

const mockRequest = {
    peerMeta: {
        name: 'Test dApp',
        url: 'https://test-dapp.com',
        icons: [],
        description: 'A test dApp',
    },
    chainId: 416001,
    permissions: ['algo_getAccounts'],
    clientId: 'client-123',
} as unknown as WalletConnectSessionRequest

const renderWithId = (id = 'sheet-1') =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <ConnectionSuccessContent request={mockRequest} />
        </BottomSheetIdContext.Provider>,
    )

describe('ConnectionSuccessContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        vi.clearAllMocks()
    })

    test('displays the dApp name in title and body', () => {
        renderWithId()

        expect(
            screen.getByText(
                /walletconnect\.request\.success_sheet_title.*Test dApp/,
            ),
        ).toBeDefined()
        expect(
            screen.getByText(
                /walletconnect\.request\.success_sheet_body.*Test dApp/,
            ),
        ).toBeDefined()
    })

    test('shows the check icon', () => {
        renderWithId()

        expect(screen.getByTestId('PWIcon')).toBeDefined()
    })

    test('dismisses the bottom sheet when Close button is pressed', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request({ id: 'sheet-1', contents: null })
        renderWithId('sheet-1')

        fireEvent.click(screen.getByText('common.close.label'))

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBeUndefined()
    })
})
