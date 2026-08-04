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

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    useExpandedFlowNavigation,
    useOnboardingExpandedFlowNavigation,
} from '../useExpandedFlowNavigation.web'

const consumeInitialExpandedFlowMock = vi.fn()
const setIsOnboardingMock = vi.fn()

vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    consumeInitialExpandedFlow: () => consumeInitialExpandedFlowMock(),
}))

vi.mock('@modules/onboarding/hooks', () => ({
    useIsOnboarding: () => ({
        isOnboarding: false,
        setIsOnboarding: setIsOnboardingMock,
    }),
}))

describe('useExpandedFlowNavigation', () => {
    beforeEach(() => {
        consumeInitialExpandedFlowMock.mockReset()
    })

    it('navigates to AddAccount when the flow is add-account', () => {
        consumeInitialExpandedFlowMock.mockReturnValue('add-account')
        const navigate = vi.fn()
        const { result } = renderHook(() => useExpandedFlowNavigation(navigate))

        result.current()

        expect(navigate).toHaveBeenCalledWith('AddAccount')
        expect(navigate).toHaveBeenCalledTimes(1)
    })

    it('navigates to BackupWallet when the flow is backup-wallet', () => {
        consumeInitialExpandedFlowMock.mockReturnValue('backup-wallet')
        const navigate = vi.fn()
        const { result } = renderHook(() => useExpandedFlowNavigation(navigate))

        result.current()

        expect(navigate).toHaveBeenCalledWith('BackupWallet')
        expect(navigate).toHaveBeenCalledTimes(1)
    })

    it('navigates to ScanQR when the flow is scan', () => {
        consumeInitialExpandedFlowMock.mockReturnValue('scan')
        const navigate = vi.fn()
        const { result } = renderHook(() => useExpandedFlowNavigation(navigate))

        result.current()

        expect(navigate).toHaveBeenCalledWith('ScanQR')
        expect(navigate).toHaveBeenCalledTimes(1)
    })

    it('deep-links into LedgerScan with transportType usb when the flow is ledger-usb', () => {
        consumeInitialExpandedFlowMock.mockReturnValue('ledger-usb')
        const navigate = vi.fn()
        const { result } = renderHook(() => useExpandedFlowNavigation(navigate))

        result.current()

        expect(navigate).toHaveBeenCalledWith('AddAccount', {
            screen: 'LedgerScan',
            params: { transportType: 'usb' },
        })
        expect(navigate).toHaveBeenCalledTimes(1)
    })

    it('deep-links into LedgerScan with transportType ble when the flow is ledger-ble', () => {
        consumeInitialExpandedFlowMock.mockReturnValue('ledger-ble')
        const navigate = vi.fn()
        const { result } = renderHook(() => useExpandedFlowNavigation(navigate))

        result.current()

        expect(navigate).toHaveBeenCalledWith('AddAccount', {
            screen: 'LedgerScan',
            params: { transportType: 'ble' },
        })
        expect(navigate).toHaveBeenCalledTimes(1)
    })

    it('does not navigate when there is no flow', () => {
        consumeInitialExpandedFlowMock.mockReturnValue(null)
        const navigate = vi.fn()
        const { result } = renderHook(() => useExpandedFlowNavigation(navigate))

        result.current()

        expect(navigate).not.toHaveBeenCalled()
    })

    it('does not navigate for an unknown flow (already filtered upstream)', () => {
        // consumeInitialExpandedFlow's own allowlist means this shouldn't
        // happen in practice, but the dispatcher must stay a strict allowlist
        // too rather than trusting its input.
        consumeInitialExpandedFlowMock.mockReturnValue('evil')
        const navigate = vi.fn()
        const { result } = renderHook(() => useExpandedFlowNavigation(navigate))

        result.current()

        expect(navigate).not.toHaveBeenCalled()
    })

    it('deep-links into AsbImportBackup when the flow is asb-import', () => {
        consumeInitialExpandedFlowMock.mockReturnValue('asb-import')
        const navigate = vi.fn()
        const { result } = renderHook(() => useExpandedFlowNavigation(navigate))

        result.current()

        expect(navigate).toHaveBeenCalledWith('AddAccount', {
            screen: 'AsbImportBackup',
        })
        expect(navigate).toHaveBeenCalledTimes(1)
    })
})

describe('useOnboardingExpandedFlowNavigation', () => {
    beforeEach(() => {
        consumeInitialExpandedFlowMock.mockReset()
        setIsOnboardingMock.mockReset()
    })

    it.each([
        ['ledger-usb', 'usb'],
        ['ledger-ble', 'ble'],
    ])('navigates to LedgerScan for %s', (flow, transportType) => {
        consumeInitialExpandedFlowMock.mockReturnValue(flow)
        const navigate = vi.fn()
        const { result } = renderHook(() =>
            useOnboardingExpandedFlowNavigation(navigate),
        )

        result.current()

        expect(navigate).toHaveBeenCalledWith('LedgerScan', { transportType })
        expect(navigate).toHaveBeenCalledTimes(1)
    })

    it('navigates to AsbImportBackup for asb-import', () => {
        consumeInitialExpandedFlowMock.mockReturnValue('asb-import')
        const navigate = vi.fn()
        const { result } = renderHook(() =>
            useOnboardingExpandedFlowNavigation(navigate),
        )

        result.current()

        expect(navigate).toHaveBeenCalledWith('AsbImportBackup')
        expect(navigate).toHaveBeenCalledTimes(1)
    })

    // Without this the imported account makes `useShowOnboarding` false and the
    // shell swaps the onboarding stack for the main one mid-flow.
    it('pins the shell to onboarding before navigating', () => {
        consumeInitialExpandedFlowMock.mockReturnValue('ledger-usb')
        const { result } = renderHook(() =>
            useOnboardingExpandedFlowNavigation(vi.fn()),
        )

        result.current()

        expect(setIsOnboardingMock).toHaveBeenCalledWith(true)
    })

    it.each(['add-account', 'backup-wallet', 'scan', null, 'evil'])(
        'ignores %s, which has no onboarding-stack destination',
        flow => {
            consumeInitialExpandedFlowMock.mockReturnValue(flow)
            const navigate = vi.fn()
            const { result } = renderHook(() =>
                useOnboardingExpandedFlowNavigation(navigate),
            )

            result.current()

            expect(navigate).not.toHaveBeenCalled()
            expect(setIsOnboardingMock).not.toHaveBeenCalled()
        },
    )
})
