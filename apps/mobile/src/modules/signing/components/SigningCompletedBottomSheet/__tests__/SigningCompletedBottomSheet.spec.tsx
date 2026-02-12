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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { SigningCompletedBottomSheet } from '../SigningCompletedBottomSheet'
import { useSigningRequest, type SignRequest } from '@perawallet/wallet-core-signing'

const mockClearLastCompletedRequest = vi.fn()

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: vi.fn(() => ({
        lastCompletedRequest: null,
        clearLastCompletedRequest: mockClearLastCompletedRequest,
    })),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    deferToNextCycle: (cb: () => void) => setTimeout(cb, 0),
}))

vi.mock('@components/core', () => ({
    PWBottomSheet: ({
        children,
        isVisible,
    }: {
        children: React.ReactNode
        isVisible: boolean
    }) =>
        isVisible ? <div data-testid='PWBottomSheet'>{children}</div> : null,
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

const mockTransactionRequest = {
    id: 'tx-1',
    type: 'transactions',
    transport: 'algod',
    txs: [],
} as unknown as SignRequest

const mockArbitraryDataRequest = {
    id: 'data-1',
    type: 'arbitrary-data',
    transport: 'callback',
    data: [],
} as unknown as SignRequest

describe('SigningCompletedBottomSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    test('does not render when lastCompletedRequest is null', () => {
        vi.mocked(useSigningRequest).mockReturnValue({
            lastCompletedRequest: null,
            clearLastCompletedRequest: mockClearLastCompletedRequest,
        } as unknown as ReturnType<typeof useSigningRequest>)

        render(<SigningCompletedBottomSheet />)

        expect(screen.queryByTestId('PWBottomSheet')).toBeNull()
    })

    test('shows transaction messaging when type is transactions', () => {
        vi.mocked(useSigningRequest).mockReturnValue({
            lastCompletedRequest: mockTransactionRequest,
            clearLastCompletedRequest: mockClearLastCompletedRequest,
        } as unknown as ReturnType<typeof useSigningRequest>)

        render(<SigningCompletedBottomSheet />)
        act(() => {
            vi.runAllTimers()
        })

        expect(
            screen.getByText('signing.signing_completed.transaction_title'),
        ).toBeDefined()
        expect(
            screen.getByText('signing.signing_completed.transaction_body'),
        ).toBeDefined()
    })

    test('shows data messaging when type is arbitrary-data', () => {
        vi.mocked(useSigningRequest).mockReturnValue({
            lastCompletedRequest: mockArbitraryDataRequest,
            clearLastCompletedRequest: mockClearLastCompletedRequest,
        } as unknown as ReturnType<typeof useSigningRequest>)

        render(<SigningCompletedBottomSheet />)
        act(() => {
            vi.runAllTimers()
        })

        expect(
            screen.getByText('signing.signing_completed.data_title'),
        ).toBeDefined()
        expect(
            screen.getByText('signing.signing_completed.data_body'),
        ).toBeDefined()
    })

    test('calls clearLastCompletedRequest on Done button press', () => {
        vi.mocked(useSigningRequest).mockReturnValue({
            lastCompletedRequest: mockTransactionRequest,
            clearLastCompletedRequest: mockClearLastCompletedRequest,
        } as unknown as ReturnType<typeof useSigningRequest>)

        render(<SigningCompletedBottomSheet />)
        act(() => {
            vi.runAllTimers()
        })

        fireEvent.click(screen.getByText('common.done'))

        expect(mockClearLastCompletedRequest).toHaveBeenCalledTimes(1)
    })
})
