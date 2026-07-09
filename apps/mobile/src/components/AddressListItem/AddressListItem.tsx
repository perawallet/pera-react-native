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

import { getAccountDisplayName } from '@perawallet/wallet-core-accounts'
import { dedupeSecondaryLabel } from '@perawallet/wallet-core-shared'
import { PWListItemLayout, PWText, PWView } from '@components/core'
import { ContactAvatar } from '@components/ContactAvatar'
import { AccountIcon } from '@modules/accounts/components/AccountIcon'
import { useAddressDisplay } from '@components/AddressDisplay/useAddressDisplay'

import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { ContactAvatarVariant } from '@components/ContactAvatar/styles'
import { useStyles } from './styles'

export type AddressListItemProps = {
    /** Address to resolve into avatar + name/address. */
    address: string
    /** Sticky trailing slot (action button, status icon, chevron, etc.). */
    right?: ReactNode
    /** Avatar emphasis, forwarded to `ContactAvatar` for non-account rows. */
    avatarVariant?: ContactAvatarVariant
    /**
     * Hairline divider that begins at the name column (clearing the avatar) and
     * runs to the trailing edge. Off by default — card rows separate via their
     * own background instead.
     */
    showDivider?: boolean
    onPress?: () => void
    /** Row-level overrides — e.g. card background/border/padding. */
    style?: StyleProp<ViewStyle>
    testID?: string
}

export const AddressListItem = ({
    address,
    right,
    avatarVariant = 'default',
    showDivider = false,
    onPress,
    style,
    testID,
}: AddressListItemProps) => {
    const styles = useStyles()
    // Reuse the shared resolution (wallet account → contact → NFD → raw
    // address) so we don't duplicate those lookups; only the layout differs
    // from AddressDisplay.
    const { account, contact, nfdName, truncatedAddress } = useAddressDisplay({
        address,
        addressFormat: 'short',
        displayType: 'full',
        showSecondaryAddress: false,
    })

    const primary = account
        ? getAccountDisplayName(account)
        : (contact?.name ?? nfdName ?? truncatedAddress)
    // Show the address underneath only when the primary line is a distinct
    // label (name/NFD); otherwise the primary line already *is* the address.
    const secondary = dedupeSecondaryLabel(primary, truncatedAddress)

    const avatar = account ? (
        <AccountIcon
            account={account}
            size='lg'
        />
    ) : (
        <ContactAvatar
            size='md'
            contact={contact ?? undefined}
            variant={avatarVariant}
        />
    )

    return (
        <PWListItemLayout
            onPress={onPress}
            showDivider={showDivider}
            style={style}
            testID={testID}
            left={avatar}
            right={right}
        >
            <PWView>
                <PWText
                    variant='bodyLarge'
                    weight={500}
                    numberOfLines={1}
                    ellipsizeMode='middle'
                >
                    {primary}
                </PWText>
                {secondary != null ? (
                    <PWText
                        variant='footnoteMedium'
                        weight={400}
                        style={styles.secondary}
                        numberOfLines={1}
                        ellipsizeMode='middle'
                    >
                        {secondary}
                    </PWText>
                ) : null}
            </PWView>
        </PWListItemLayout>
    )
}
