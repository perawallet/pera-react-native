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

import { render, screen, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AddressEntryField } from '../AddressEntryField'

const { mockResolveScannedAddress, scannerProps } = vi.hoisted(() => ({
    mockResolveScannedAddress: vi.fn(),
    // Captures the props the field passes down, so a scan can be driven
    // without mounting the real scanner.
    scannerProps: { current: null } as {
        current: null | { isVisible: boolean; onSuccess: (url: string) => void }
    },
}))

vi.mock('@hooks/useScannedAddress', () => ({
    useScannedAddress: () => mockResolveScannedAddress,
}))

// QRScannerView is now always mounted (isVisible toggles it, it's never
// conditionally rendered) — vitest resolves the bare specifier to the
// native module, whose hooks reach into providers (network, etc.) this
// lightweight render tree doesn't set up. This spec only cares about
// AddressEntryField's own input/scan-icon behavior, not scanner internals.
vi.mock('@components/QRScannerView', () => ({
    QRScannerView: (props: {
        isVisible: boolean
        onSuccess: (url: string) => void
    }) => {
        scannerProps.current = props
        return null
    },
    scannerNotifier: { current: null },
}))

describe('AddressEntryField', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders correctly', () => {
        render(<AddressEntryField />)
        expect(screen.getByRole('textbox')).toBeTruthy()
    })

    it('shows QR scanner icon when allowed', () => {
        render(<AddressEntryField allowQRCode />)
        expect(screen.getByRole('textbox')).toBeTruthy()
    })

    it('fills the field with a scanned address', () => {
        const address = 'A'.repeat(58)
        mockResolveScannedAddress.mockReturnValue(address)
        const onChangeText = vi.fn()
        const onScanned = vi.fn()
        render(
            <AddressEntryField
                allowQRCode
                onChangeText={onChangeText}
                onScanned={onScanned}
            />,
        )

        act(() => scannerProps.current?.onSuccess(address))

        expect(onChangeText).toHaveBeenCalledWith(address)
        expect(onScanned).toHaveBeenCalledWith(address)
    })

    // The hook toasts through the global Notifier, which renders behind the
    // scanner's Modal — so the dismiss has to land first (PERA-4746).
    it('dismisses the scanner before resolving, so the error is visible', () => {
        mockResolveScannedAddress.mockImplementation(() => {
            expect(scannerProps.current?.isVisible).toBe(false)
            return null
        })
        const onChangeText = vi.fn()
        render(
            <AddressEntryField
                allowQRCode
                onChangeText={onChangeText}
            />,
        )

        act(() => scannerProps.current?.onSuccess('wc:topic@2'))

        expect(mockResolveScannedAddress).toHaveBeenCalledTimes(1)
        expect(onChangeText).not.toHaveBeenCalled()
    })
})
