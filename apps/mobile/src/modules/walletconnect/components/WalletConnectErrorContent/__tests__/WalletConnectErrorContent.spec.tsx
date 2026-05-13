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
import { WalletConnectErrorContent } from '../WalletConnectErrorContent'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { debug: vi.fn() },
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: { debugEnabled: false },
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
        errorMessage: {},
        retryMessage: {},
    }),
}))

const renderWithId = (
    error: Error | null = new Error('Some error'),
    id = 'sheet-1',
) =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <WalletConnectErrorContent error={error} />
        </BottomSheetIdContext.Provider>,
    )

describe('WalletConnectErrorContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        vi.clearAllMocks()
    })

    test('renders the error contents', () => {
        renderWithId()

        expect(screen.getByTestId('PWView')).toBeDefined()
    })

    test('displays the error message', () => {
        renderWithId(new Error('Invalid public key(s)'))

        expect(screen.getByText('Invalid public key(s)')).toBeDefined()
    })

    test('displays the error icon', () => {
        renderWithId()

        expect(screen.getByTestId('PWIcon')).toBeDefined()
    })

    test('dismisses the bottom sheet when Ok button is pressed', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request({ id: 'sheet-1', contents: null })
        renderWithId(new Error('Some error'), 'sheet-1')

        fireEvent.click(screen.getByText('common.ok.label'))

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBeUndefined()
    })
})
