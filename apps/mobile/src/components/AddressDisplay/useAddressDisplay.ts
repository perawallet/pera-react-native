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

import { useMemo } from 'react'
import {
    LONG_ADDRESS_LENGTH,
    type Optional,
    truncateAlgorandAddress,
} from '@perawallet/wallet-core-shared'
import {
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useContacts, type Contact } from '@perawallet/wallet-core-contacts'
import { useNfdForAddressQuery } from '@perawallet/wallet-core-nfd'
import { useClipboard } from '@hooks/useClipboard'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import type { IconName } from '@components/core'

export type AddressFormat = 'short' | 'long' | 'full'
export type AddressDisplayType = 'full' | 'simple' | 'address-only'

type UseAddressDisplayProps = {
    address: string
    addressFormat: AddressFormat
    displayType: AddressDisplayType
    showSecondaryAddress: boolean
}

type ResolvedLabels = {
    primary: string
    secondary: Optional<string>
}

type UseAddressDisplayResult = {
    account: WalletAccount | null
    contact: Contact | null
    nfdName: Optional<string>
    truncatedAddress: string
    fallbackIconName: IconName
    copyAddress: () => void
    unifiedLabels: ResolvedLabels
}

const resolveUnifiedLabels = ({
    account,
    contact,
    nfdName,
    truncatedAddress,
    showSecondaryAddress,
}: {
    account: WalletAccount | null
    contact: Contact | null
    nfdName: Optional<string>
    truncatedAddress: string
    showSecondaryAddress: boolean
}): ResolvedLabels => {
    if (account) {
        return { primary: truncatedAddress, secondary: undefined }
    }

    if (contact) {
        return showSecondaryAddress
            ? { primary: truncatedAddress, secondary: contact.name }
            : { primary: contact.name, secondary: undefined }
    }

    if (nfdName) {
        return {
            primary: nfdName,
            secondary: showSecondaryAddress ? truncatedAddress : undefined,
        }
    }

    return { primary: truncatedAddress, secondary: undefined }
}

const formatAddress = (address: string, format: AddressFormat): string => {
    switch (format) {
        case 'full': {
            return address
        }
        case 'long': {
            return truncateAlgorandAddress(address, LONG_ADDRESS_LENGTH)
        }
        case 'short':
        default: {
            return truncateAlgorandAddress(address)
        }
    }
}

export const useAddressDisplay = ({
    address,
    addressFormat,
    displayType,
    showSecondaryAddress,
}: UseAddressDisplayProps): UseAddressDisplayResult => {
    const { copyToClipboard } = useClipboard()
    const isDarkMode = useIsDarkMode()
    const accounts = useAllAccounts()
    const { findContacts } = useContacts()

    const isAddressOnly = displayType === 'address-only'

    const account = useMemo(() => {
        if (displayType !== 'full') {
            return null
        }
        return accounts.find(a => a.address === address) ?? null
    }, [displayType, accounts, address])

    const contact = useMemo(() => {
        if (isAddressOnly) {
            return null
        }
        return (
            findContacts({
                keyword: address,
                matchAddress: true,
                matchName: false,
                matchNFD: true,
            }).at(0) ?? null
        )
    }, [isAddressOnly, address, findContacts])

    const { data: nfdNames } = useNfdForAddressQuery(address, {
        enabled: !isAddressOnly && !account && !contact,
    })

    const nfdName = useMemo(() => nfdNames?.at(0)?.name, [nfdNames])

    const truncatedAddress = useMemo(
        () => formatAddress(address, addressFormat),
        [address, addressFormat],
    )

    const fallbackIconName: IconName = `accounts/${isDarkMode ? 'dark' : 'light'}/algo25-account`

    const copyAddress = () => {
        void copyToClipboard(address)
    }

    const unifiedLabels = useMemo(
        () =>
            resolveUnifiedLabels({
                account,
                contact,
                nfdName,
                truncatedAddress,
                showSecondaryAddress,
            }),
        [account, contact, nfdName, truncatedAddress, showSecondaryAddress],
    )

    return {
        account,
        contact,
        nfdName,
        truncatedAddress,
        fallbackIconName,
        copyAddress,
        unifiedLabels,
    }
}
