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

import { render, screen } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
const mockErrorToast = vi.fn()
const mockRequestPermissions = vi.fn()
const mockOpenSettings = vi.fn()

const mockRouteParams: { transportType?: 'ble' | 'usb' } = {}

vi.mock('@react-navigation/native', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...actual,
        useRoute: () => ({ params: mockRouteParams }),
    }
})

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ errorToast: mockErrorToast }),
}))

vi.mock('../../../hooks', () => ({
    useBlePermissions: () => ({
        hasPermissions: true,
        isChecking: false,
        isBlocked: false,
        requestPermissions: mockRequestPermissions,
        openSettings: mockOpenSettings,
    }),
}))

import { LedgerInstructionsScreen } from '../LedgerInstructionsScreen'

describe('LedgerInstructionsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRouteParams.transportType = undefined
    })

    it('renders BLE-specific copy by default', () => {
        render(<LedgerInstructionsScreen />)

        expect(screen.getByText('ledger.instructions.title')).toBeTruthy()
        expect(screen.getByText('ledger.instructions.description')).toBeTruthy()
        expect(screen.getByText('ledger.instructions.step_1')).toBeTruthy()
        expect(screen.getByText('ledger.instructions.step_2')).toBeTruthy()
        expect(screen.getByText('ledger.instructions.step_3')).toBeTruthy()
    })

    it('renders BLE-specific copy when transportType is ble', () => {
        mockRouteParams.transportType = 'ble'

        render(<LedgerInstructionsScreen />)

        expect(screen.getByText('ledger.instructions.title')).toBeTruthy()
        expect(screen.getByText('ledger.instructions.description')).toBeTruthy()
        expect(screen.getByText('ledger.instructions.step_1')).toBeTruthy()
    })

    it('renders USB-specific copy when transportType is usb', () => {
        mockRouteParams.transportType = 'usb'

        render(<LedgerInstructionsScreen />)

        expect(screen.getByText('ledger.instructions.usb.title')).toBeTruthy()
        expect(
            screen.getByText('ledger.instructions.usb.description'),
        ).toBeTruthy()
        expect(screen.getByText('ledger.instructions.usb.step_1')).toBeTruthy()
        expect(screen.getByText('ledger.instructions.usb.step_2')).toBeTruthy()
        expect(screen.getByText('ledger.instructions.usb.step_3')).toBeTruthy()
    })
})
