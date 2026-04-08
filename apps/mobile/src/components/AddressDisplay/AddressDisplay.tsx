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

import {
    PWIcon,
    PWText,
    PWTextProps,
    PWTouchableOpacityProps,
    PWView,
} from '@components/core'
import { CopyableText } from '@components/CopyableText'
import { useStyles } from './styles'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { useNfdForAddressQuery } from '@perawallet/wallet-core-nfd'
import { useClipboard } from '@hooks/useClipboard'

import { SvgProps } from 'react-native-svg'
import { useCallback, useMemo } from 'react'
import { ContactAvatar } from '@components/ContactAvatar'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { useIsDarkMode } from '@hooks/useIsDarkMode'

export type AddressDisplayProps = {
    address: string
    addressFormat?: 'short' | 'long' | 'full'
    displayType?: 'full' | 'simple' | 'address-only'
    showCopy?: boolean
    forceShowIcon?: boolean
    textProps?: PWTextProps
    iconProps?: SvgProps
} & PWTouchableOpacityProps

const LONG_ADDRESS_FORMAT = 20

export const AddressDisplay = ({
    address,
    addressFormat = 'short',
    displayType = 'full',
    showCopy = true,
    forceShowIcon = false,
    textProps,
    iconProps,
    ...rest
}: AddressDisplayProps) => {
    const styles = useStyles()
    const { copyToClipboard } = useClipboard()
    const isDarkMode = useIsDarkMode()

    const copyAddress = () => {
        copyToClipboard(address)
    }

    const accounts = useAllAccounts()
    const { findContacts } = useContacts()

    const account = useMemo(() => {
        if (displayType !== 'full') {
            return null
        }

        return accounts.find(a => a.address === address)
    }, [displayType, accounts, address])

    const contact = useMemo(() => {
        if (displayType === 'address-only') {
            return null
        }
        return findContacts({
            keyword: address,
            matchAddress: true,
            matchName: false,
            matchNFD: true,
        }).at(0)
    }, [displayType, address, findContacts])

    const { data: nfdNames } = useNfdForAddressQuery(address, {
        enabled: displayType !== 'address-only' && !account && !contact,
    })

    const nfdName = useMemo(() => nfdNames?.at(0)?.name, [nfdNames])

    const truncatedAddress =
        addressFormat === 'full'
            ? address
            : addressFormat === 'long'
              ? truncateAlgorandAddress(address, LONG_ADDRESS_FORMAT)
              : truncateAlgorandAddress(address)

    const renderAddressView = useCallback(() => {
        if (account) {
            return (
                <AccountDisplay
                    account={account}
                    textProps={textProps}
                    showChevron={false}
                />
            )
        }

        if (contact) {
            return (
                <PWView style={styles.contactContainer}>
                    <ContactAvatar
                        size='md'
                        contact={contact}
                    />
                    <PWText {...textProps}>{contact.name}</PWText>
                </PWView>
            )
        }

        if (nfdName) {
            return (
                <PWView style={styles.contactContainer}>
                    <PWIcon
                        name={`accounts/${isDarkMode ? 'dark' : 'light'}/algo25-account`}
                        size='lg'
                    />
                    <PWText {...textProps}>{nfdName}</PWText>
                </PWView>
            )
        }

        return (
            <PWView style={styles.contactContainer}>
                {forceShowIcon && (
                    <PWIcon
                        name={`accounts/${isDarkMode ? 'dark' : 'light'}/algo25-account`}
                        size='lg'
                    />
                )}
                <PWText {...textProps}>{truncatedAddress}</PWText>
            </PWView>
        )
    }, [
        account,
        contact,
        nfdName,
        isDarkMode,
        forceShowIcon,
        truncatedAddress,
        textProps,
        styles.contactContainer,
    ])

    return (
        <CopyableText
            {...rest}
            copyValue={address}
            style={[styles.addressValueContainer, rest.style]}
        >
            {renderAddressView()}

            {showCopy && (
                <PWIcon
                    name='copy'
                    size='sm'
                    variant='secondary'
                    {...iconProps}
                    onPress={copyAddress}
                />
            )}
        </CopyableText>
    )
}
