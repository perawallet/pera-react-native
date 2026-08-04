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
    // Keyreg carries its account as `senderAddress`; without this a QR that
    // does hold an address would be reported as holding none.
    if ('senderAddress' in parsed && parsed.senderAddress) {
        return parsed.senderAddress
    }

    return null
}

/**
 * Resolves an address from a scanned QR, surfacing a readable error when the
 * code carries none.
 *
 * Shared by every address-field scanner (AddressEntryField, ContactForm) so the
 * wrong-context message is worded once.
 *
 * The addressless-but-parseable set this exists for is WalletConnect v1,
 * liquid-auth (`fido:`/`liquid:`), Pera web import and the legacy mnemonic JSON
 * payloads. Note a WalletConnect *v2* URI never reaches here: the parser only
 * accepts a `wc:` URI carrying `bridge=`, so a v2 pairing code fails
 * `isValidDeepLink` and the scanner rejects it upstream (PERA-4746).
 *
 * Callers must dismiss the scanner too, but the toast does not depend on doing
 * so first: it routes to the global Notifier, which renders in the root tree and
 * is hidden behind the scanner's native Modal. The `short` delay is what keeps
 * it out from under the Modal — long enough for the dismiss animation to finish,
 * rather than racing it on the next macrotask.
 */
export const useScannedAddress = (): ((url: string) => Nullable<string>) => {
    const { t } = useLanguage()
    const { showToast } = useToast()

    return useCallback(
        (url: string) => {
            const address = extractAddressFromScannedUrl(url)

            if (!address) {
                showToast(
                    {
                        title: t('address_entry.invalid_qr_title'),
                        body: t('address_entry.invalid_qr_body'),
                        type: 'error',
                    },
                    { delayLength: 'short' },
                )
            }

            return address
        },
        [showToast, t],
    )
}
