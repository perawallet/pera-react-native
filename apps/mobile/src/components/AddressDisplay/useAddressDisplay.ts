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
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    findAccountByAddressOn,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    LEGACY_CHAIN_ID,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    findContactByAddress,
    useContacts,
    type Contact,
} from '@perawallet/wallet-core-contacts'
import { useNfdForAddressQuery } from '@perawallet/wallet-core-nfd'
import {
    getChainDescriptor,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import { useAddressReuseGuard } from '@components/AddressReuseGuard'
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
    /** The address's chain; the selected Algorand scope when unset. */
    scope?: ChainScope
}

type ResolvedLabels = {
    primary: string
    secondary: Optional<string>
}

type UseAddressDisplayResult = {
    account: Nullable<WalletAccount>
    contact: Nullable<Contact>
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
    account: Nullable<WalletAccount>
    contact: Nullable<Contact>
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

const formatAddress = (
    address: string,
    format: AddressFormat,
    chainId: ChainId,
): string => {
    const codec =
        addressCodecs.has(chainId) &&
        addressCodecs.get(chainId).isValid(address)
            ? addressCodecs.get(chainId)
            : undefined
    switch (format) {
        case 'full': {
            return codec ? codec.normalize(address) : address
        }
        case 'long': {
            return truncateAlgorandAddress(address, LONG_ADDRESS_LENGTH)
        }
        case 'short':
        default: {
            return codec
                ? codec.truncate(address)
                : truncateAlgorandAddress(address)
        }
    }
}

export const useAddressDisplay = ({
    address,
    addressFormat,
    displayType,
    showSecondaryAddress,
    scope: addressScope,
}: UseAddressDisplayProps): UseAddressDisplayResult => {
    const legacyScope = useSelectedScope(LEGACY_CHAIN_ID)
    const scope = addressScope ?? legacyScope
    const { copyToClipboard } = useClipboard()
    const { confirmReuse } = useAddressReuseGuard()
    const isDarkMode = useIsDarkMode()
    const accounts = useAllAccounts()
    const { contacts } = useContacts()

    const isAddressOnly = displayType === 'address-only'

    const account = useMemo(() => {
        if (displayType !== 'full') {
            return null
        }
        return findAccountByAddressOn(accounts, scope.chainId, address) ?? null
    }, [displayType, accounts, address, scope.chainId])

    // A caller that names the address's chain gets only that family's
    // contacts; without one the address may belong to any family.
    const contactFamily = addressScope
        ? getChainDescriptor(addressScope.chainId).family
        : undefined
    const contact = useMemo(() => {
        if (isAddressOnly) {
            return null
        }
        return findContactByAddress(contacts, address, contactFamily) ?? null
    }, [isAddressOnly, address, contacts, contactFamily])

    const { data: nfdNames } = useNfdForAddressQuery(scope, address, {
        enabled: !isAddressOnly && !account && !contact,
    })

    const nfdName = useMemo(() => nfdNames?.at(0)?.name, [nfdNames])

    const truncatedAddress = useMemo(
        () => formatAddress(address, addressFormat, scope.chainId),
        [address, addressFormat, scope.chainId],
    )

    const fallbackIconName: IconName = `accounts/${isDarkMode ? 'dark' : 'light'}/algo25-account`

    const copyAddress = () => {
        void (async () => {
            if (await confirmReuse(address)) await copyToClipboard(address)
        })()
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
