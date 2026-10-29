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

import { useCallback, useMemo, useState } from 'react'
import {
    CHAIN_FAMILIES,
    type ChainFamily,
} from '@perawallet/wallet-core-chain-contract'
import type { Contact } from '@perawallet/wallet-core-contacts'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useClipboard } from '@hooks/useClipboard'
import { useLanguage } from '@hooks/useLanguage'
import { chainFamilyDisplay } from '@modules/chain-ui'
import { shareText } from '@utils/shareText'

export type ContactQRFamilyOption = { family: ChainFamily; label: string }

export type UseContactQRContentResult = {
    /** Empty for a contact with a single address: there is nothing to switch. */
    familyOptions: ContactQRFamilyOption[]
    selectedFamily: Optional<ChainFamily>
    address: string
    shortAddress: string
    selectFamily: (family: ChainFamily) => void
    handleCopy: () => void
    handleShare: () => Promise<void>
}

export const useContactQRContent = (
    contact: Contact,
    initialFamily?: ChainFamily,
): UseContactQRContentResult => {
    const { t } = useLanguage()
    const { copyToClipboard } = useClipboard()

    const families = useMemo(
        () => CHAIN_FAMILIES.filter(family => !!contact.addresses[family]),
        [contact.addresses],
    )
    const [chosenFamily, setChosenFamily] = useState(initialFamily)
    const selectedFamily =
        chosenFamily && families.includes(chosenFamily)
            ? chosenFamily
            : families[0]
    const address = (selectedFamily && contact.addresses[selectedFamily]) ?? ''
    const display = useMemo(
        () => (selectedFamily ? chainFamilyDisplay(selectedFamily, t) : null),
        [selectedFamily, t],
    )

    const familyOptions = useMemo(
        (): ContactQRFamilyOption[] =>
            families.length > 1
                ? families.map(family => ({
                      family,
                      label: chainFamilyDisplay(family, t).label,
                  }))
                : [],
        [families, t],
    )

    const handleCopy = useCallback(() => {
        void copyToClipboard(address)
    }, [address, copyToClipboard])

    const handleShare = useCallback(async () => {
        try {
            await shareText({ title: contact.name, message: address })
        } catch {
            // User cancelled — ignore.
        }
    }, [contact.name, address])

    return {
        familyOptions,
        selectedFamily,
        address,
        shortAddress: display?.truncate(address) ?? address,
        selectFamily: setChosenFamily,
        handleCopy,
        handleShare,
    }
}
