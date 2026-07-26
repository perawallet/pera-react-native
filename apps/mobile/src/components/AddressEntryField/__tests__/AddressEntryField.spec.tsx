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

import { render, screen } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    AddressEntryField,
    extractAddressFromScannedUrl,
} from '../AddressEntryField'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import { parseDeeplink } from '@hooks/deeplink/parser'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    isValidAlgorandAddress: vi.fn(),
}))

vi.mock('@hooks/deeplink/parser', () => ({
    parseDeeplink: vi.fn(),
}))

// QRScannerView is now always mounted (isVisible toggles it, it's never
// conditionally rendered) — vitest resolves the bare specifier to the
// native module, whose hooks reach into providers (network, etc.) this
// lightweight render tree doesn't set up. This spec only cares about
// AddressEntryField's own input/scan-icon behavior, not scanner internals.
vi.mock('@components/QRScannerView', () => ({
    QRScannerView: () => null,
    scannerNotifier: { current: null },
}))

describe('AddressEntryField', () => {
    it('renders correctly', () => {
        render(<AddressEntryField />)
        expect(screen.getByRole('textbox')).toBeTruthy()
    })

    it('shows QR scanner icon when allowed', () => {
        render(<AddressEntryField allowQRCode />)
        expect(screen.getByRole('textbox')).toBeTruthy()
    })
})

describe('extractAddressFromScannedUrl', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(isValidAlgorandAddress).mockReturnValue(false)
        vi.mocked(parseDeeplink).mockReturnValue(null)
    })

    it('returns raw address when it is a valid Algorand address', () => {
        const rawAddress =
            'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        vi.mocked(isValidAlgorandAddress).mockReturnValue(true)

        expect(extractAddressFromScannedUrl(rawAddress)).toBe(rawAddress)
        expect(parseDeeplink).not.toHaveBeenCalled()
    })

    it('extracts address from algorand:// deeplink with address field', () => {
        const address = 'EXTRACTED_ADDRESS_123'
        vi.mocked(parseDeeplink).mockReturnValue({
            type: 'ADDRESS_ACTIONS',
            address,
            sourceUrl: `algorand://${address}`,
        } as ReturnType<typeof parseDeeplink>)

        expect(extractAddressFromScannedUrl(`algorand://${address}`)).toBe(
            address,
        )
    })

    it('extracts receiverAddress from transfer deeplink', () => {
        const receiverAddress = 'RECEIVER_ADDRESS_456'
        vi.mocked(parseDeeplink).mockReturnValue({
            type: 'ALGO_TRANSFER',
            receiverAddress,
            sourceUrl: 'algorand://...',
        } as ReturnType<typeof parseDeeplink>)

        expect(extractAddressFromScannedUrl('algorand://...')).toBe(
            receiverAddress,
        )
    })

    it('returns null for unsupported URL', () => {
        expect(
            extractAddressFromScannedUrl('https://random-site.com'),
        ).toBeNull()
    })

    it('returns null when deeplink has no address fields', () => {
        vi.mocked(parseDeeplink).mockReturnValue({
            type: 'HOME',
            sourceUrl: 'perawallet://home',
        } as ReturnType<typeof parseDeeplink>)

        expect(extractAddressFromScannedUrl('perawallet://home')).toBeNull()
    })
})
