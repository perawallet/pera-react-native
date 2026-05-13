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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import {
    useHardwareSigning,
    useSigningRequest,
    type SignRequest,
    type HardwareSigningStatus,
    type UseHardwareSigningResult,
} from '@perawallet/wallet-core-signing'
import { SignRequestBottomSheet } from '../SignRequestBottomSheet'

vi.mock('@perawallet/wallet-core-signing', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-signing')>()
    return {
        ...actual,
        useHardwareSigning: vi.fn(),
        useSigningRequest: vi.fn(),
    }
})

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        deferToNextCycle: (cb: () => void) => setTimeout(cb, 0),
    }
})

vi.mock('@modules/signing/components/SignRequestView', () => ({
    SignRequestView: () => <div data-testid='sign-request-view' />,
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
}))

const buildHardwareSigningResult = (
    overrides: Partial<UseHardwareSigningResult> = {},
): UseHardwareSigningResult => ({
    isActive: false,
    status: 'idle',
    deviceName: null,
    currentTx: null,
    totalTxs: null,
    requestId: null,
    error: null,
    resolveActiveRequest: vi.fn(() => undefined),
    dismiss: vi.fn(),
    ...overrides,
})

const pendingRequest = {
    id: 'r1',
    headless: false,
    transport: 'algod',
} as unknown as SignRequest

describe('SignRequestBottomSheet hardware-active gating', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.mocked(useSigningRequest).mockReturnValue({
            pendingSignRequests: [pendingRequest],
            lastCompletedRequest: null,
        } as unknown as ReturnType<typeof useSigningRequest>)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders the sheet while hardware signing is idle', () => {
        vi.mocked(useHardwareSigning).mockReturnValue(
            buildHardwareSigningResult({ status: 'idle' }),
        )
        render(<SignRequestBottomSheet />)
        act(() => {
            vi.runAllTimers()
        })
        expect(screen.queryByTestId('PWBottomSheet')).not.toBeNull()
    })

    it.each<HardwareSigningStatus>([
        'searching',
        'awaitingApproval',
        'signing',
        'error',
    ])('hides the sheet when hardware signing status is %s', status => {
        vi.mocked(useHardwareSigning).mockReturnValue(
            buildHardwareSigningResult({
                status,
                isActive: status !== 'searching',
            }),
        )
        render(<SignRequestBottomSheet />)
        act(() => {
            vi.runAllTimers()
        })
        expect(screen.queryByTestId('PWBottomSheet')).toBeNull()
    })

    it('does not render when there is no pending non-headless request', () => {
        vi.mocked(useSigningRequest).mockReturnValue({
            pendingSignRequests: [],
            lastCompletedRequest: null,
        } as unknown as ReturnType<typeof useSigningRequest>)
        vi.mocked(useHardwareSigning).mockReturnValue(
            buildHardwareSigningResult({ status: 'idle' }),
        )
        render(<SignRequestBottomSheet />)
        act(() => {
            vi.runAllTimers()
        })
        expect(screen.queryByTestId('PWBottomSheet')).toBeNull()
    })
})
