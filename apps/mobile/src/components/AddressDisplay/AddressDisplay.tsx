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

import { useTheme } from '@rneui/themed'
import {
    PWIcon,
    PWText,
    PWTextProps,
    PWView,
    PWViewProps,
} from '@components/core'
import { useStyles } from './styles'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { useClipboard } from '@hooks/useClipboard'

import { SvgProps } from 'react-native-svg'
import { useMemo } from 'react'
import { ContactAvatar } from '@components/ContactAvatar'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'

/**
 * Props for the AddressDisplay component.
 */
type AddressDisplayProps = {
    /** The Algorand address to display */
    address: string
    /** Format of the address display (short: "ALGO...XYZ", long: "ALGORAND...XYZ", full: no truncation) */
    addressFormat?: 'short' | 'long' | 'full'
    /** If true, shows raw address instead of resolving to account/contact names */
    rawDisplay?: boolean
    /** Whether to show a copy button next to the address */
    showCopy?: boolean
    /** Custom props for the text component */
    textProps?: PWTextProps
    /** Custom props for the copy icon */
    iconProps?: SvgProps
} & PWViewProps

const LONG_ADDRESS_FORMAT = 20

//TODO add support for NFDs
/**
 * A component that displays an Algorand address.
 * It automatically attempts to resolve the address to a local account name or contact name.
 *
 * @example
 * <AddressDisplay
 *   address="ALGORAND..."
 *   addressFormat="short"
 *   showCopy={true}
 * />
 */
export const AddressDisplay = ({
    address,
    addressFormat = 'short',
    rawDisplay,
    showCopy = true,
    textProps,
    iconProps,
    ...rest
}: AddressDisplayProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { copyToClipboard } = useClipboard()

    const copyAddress = () => {
        copyToClipboard(address)
    }

    const accounts = useAllAccounts()
    const { findContacts } = useContacts()

    const account = useMemo(() => {
        if (rawDisplay) {
            return null
        }

        return accounts.find(a => a.address === address)
    }, [accounts, rawDisplay, address])

    const contact = useMemo(() => {
        if (rawDisplay) {
            return null
        }
        return findContacts({
            keyword: address,
            matchAddress: true,
            matchName: false,
            matchNFD: false,
        }).at(0)
    }, [rawDisplay, address, findContacts])

    const truncatedAddress =
        addressFormat === 'full'
            ? address
            : addressFormat === 'long'
              ? truncateAlgorandAddress(address, LONG_ADDRESS_FORMAT)
              : truncateAlgorandAddress(address)

    return (
        <PWView
            {...rest}
            style={[rest.style, styles.addressValueContainer]}
        >
            {!!account && (
                <AccountDisplay
                    account={account}
                    iconProps={{
                        width: theme.spacing.xl,
                        height: theme.spacing.xl,
                    }}
                    showChevron={false}
                />
            )}

            {!!contact && !account && (
                <PWView style={styles.contactContainer}>
                    <ContactAvatar
                        size='small'
                        contact={contact}
                    />
                    <PWText>{contact.name}</PWText>
                </PWView>
            )}

            {!contact && !account && (
                <PWText {...textProps}>{truncatedAddress}</PWText>
            )}

            {showCopy && (
                <PWIcon
                    name='copy'
                    size='sm'
                    variant='secondary'
                    {...iconProps}
                    onPress={copyAddress}
                />
            )}
        </PWView>
    )
}
