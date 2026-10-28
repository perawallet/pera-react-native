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

import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { readScannedAddress } from '@perawallet/wallet-core-deeplinks'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

/**
 * Resolves an address from a scanned QR, surfacing a readable error when the
 * code carries none.
 *
 * Shared by every address-field scanner (AddressEntryField, ContactForm) so the
 * wrong-context message is worded once. `chainIds` are the chains the field
 * takes: an address for any other chain is named as such rather than reported
 * as no address at all.
 *
 * The addressless-but-parseable set this exists for is WalletConnect v1,
 * liquid-auth (`fido:`/`liquid:`), Pera web import and the legacy mnemonic JSON
 * payloads. Anything the parser rejects outright — a WalletConnect *v2* pairing
 * code, say — also lands here rather than upstream, because the address-field
 * scanners pass `skipDeepLinkHandler` and so opt out of the recognition gate.
 * Both cases resolve to `null` and get the same toast.
 *
 * Callers must dismiss the scanner too, but the toast does not depend on doing
 * so first: it routes to the global Notifier, which renders in the root tree and
 * is hidden behind the scanner's native Modal. The `short` delay is what keeps
 * it out from under the Modal — long enough for the dismiss animation to finish,
 * rather than racing it on the next macrotask.
 */
export const useScannedAddress = (
    chainIds: readonly ChainId[],
): ((url: string) => Nullable<string>) => {
    const { t } = useLanguage()
    const { errorToast } = useToast()

    return useCallback(
        (url: string) => {
            const scanned = readScannedAddress(url, chainIds)
            if (scanned.status === 'found') return scanned.address

            errorToast(
                t('address_entry.invalid_qr_title'),
                scanned.status === 'other-chain'
                    ? t('address_entry.other_chain_qr_body', {
                          chain: getProvider().chains.get(scanned.chainId)
                              .descriptor.displayName,
                      })
                    : t('address_entry.invalid_qr_body'),
                { delayLength: 'short' },
            )

            return null
        },
        [chainIds, errorToast, t],
    )
}
