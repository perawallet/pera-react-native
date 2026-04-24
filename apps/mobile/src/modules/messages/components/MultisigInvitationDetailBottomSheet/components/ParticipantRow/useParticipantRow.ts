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

import { useMemo } from 'react'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { useNfdForAddressQuery } from '@perawallet/wallet-core-nfd'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { IconName } from '@components/core'
import { useClipboard } from '@hooks/useClipboard'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { useLanguage } from '@hooks/useLanguage'

const LONG_ADDRESS_FORMAT = 12

export type UseParticipantRowResult = {
    avatarIcon: IconName
    primaryText: string
    secondaryText: string | undefined
    onCopy: () => void
}

export const useParticipantRow = (address: string): UseParticipantRowResult => {
    const isDarkMode = useIsDarkMode()
    const { copyToClipboard } = useClipboard()
    const { t } = useLanguage()

    const accounts = useAllAccounts()
    const { findContacts } = useContacts()
    const { data: nfdNames } = useNfdForAddressQuery(address)

    const isOwnAccount = useMemo(
        () => accounts.some(a => a.address === address),
        [accounts, address],
    )

    const contact = useMemo(
        () =>
            findContacts({
                keyword: address,
                matchAddress: true,
                matchName: false,
                matchNFD: true,
            }).at(0),
        [address, findContacts],
    )

    const nfdName = nfdNames?.at(0)?.name
    const truncatedAddress = truncateAlgorandAddress(
        address,
        LONG_ADDRESS_FORMAT,
    )

    const { primaryText, secondaryText } = resolveDisplayTexts({
        isOwnAccount,
        ownAccountLabel: t('multisig.invitation.participant_address_you', {
            address: truncatedAddress,
        }),
        nfdName,
        contactName: contact?.name,
        truncatedAddress,
    })

    const avatarIcon: IconName = isDarkMode
        ? 'accounts/dark/multisig-account'
        : 'accounts/light/multisig-account'

    const onCopy = () => {
        copyToClipboard(address)
    }

    return {
        avatarIcon,
        primaryText,
        secondaryText,
        onCopy,
    }
}

type ResolveDisplayTextsArgs = {
    isOwnAccount: boolean
    ownAccountLabel: string
    nfdName: string | undefined
    contactName: string | undefined
    truncatedAddress: string
}

type DisplayTexts = {
    primaryText: string
    secondaryText: string | undefined
}

const resolveDisplayTexts = ({
    isOwnAccount,
    ownAccountLabel,
    nfdName,
    contactName,
    truncatedAddress,
}: ResolveDisplayTextsArgs): DisplayTexts => {
    if (isOwnAccount) {
        return { primaryText: ownAccountLabel, secondaryText: undefined }
    }
    if (nfdName) {
        return { primaryText: nfdName, secondaryText: truncatedAddress }
    }
    if (contactName) {
        return { primaryText: truncatedAddress, secondaryText: contactName }
    }
    return { primaryText: truncatedAddress, secondaryText: undefined }
}
