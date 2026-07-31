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

import { useCallback } from 'react'

import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import { useLanguage } from '@hooks/useLanguage'
import { parseDeeplink } from '@hooks/deeplink/parser'
import { useToast } from '@hooks/useToast'

import type { Nullable } from '@perawallet/wallet-core-shared'

export const extractAddressFromScannedUrl = (url: string): Nullable<string> => {
    if (isValidAlgorandAddress(url)) return url

    const parsed = parseDeeplink(url)
    if (!parsed) return null

    if ('receiverAddress' in parsed && parsed.receiverAddress) {
        return parsed.receiverAddress
    }
    if ('address' in parsed && parsed.address) {
        return parsed.address
    }

    return null
}

/**
 * Resolves an address from a scanned QR, surfacing a readable error when the
 * code carries none.
 *
 * Shared by every address-field scanner (AddressEntryField, ContactForm) so the
 * wrong-context message is worded once. Both used to drop the result silently:
 * a valid deeplink with no address — a WalletConnect QR is the common one —
 * closed the scanner and left the field empty with nothing said, so a
 * wrong-context scan looked identical to one that never registered (PERA-4746).
 *
 * Callers MUST dismiss the scanner before calling this. `errorToast` routes to
 * the global Notifier, which renders in the root tree and is therefore hidden
 * behind the scanner's native Modal while it is open — the same trap the
 * WalletConnect errors avoid by using `scannerNotifier`. Dismissing first
 * mirrors `useImportAccountScreen`, the scanner this message is meant to match.
 */
export const useScannedAddress = (): ((url: string) => Nullable<string>) => {
    const { t } = useLanguage()
    const { errorToast } = useToast()

    return useCallback(
        (url: string) => {
            const address = extractAddressFromScannedUrl(url)

            if (!address) {
                errorToast(
                    t('address_entry.invalid_qr_title'),
                    t('address_entry.invalid_qr_body'),
                )
            }

            return address
        },
        [errorToast, t],
    )
}
