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

import { ReactNode } from 'react'
import {
    IconName,
    PWIcon,
    PWText,
    PWTextProps,
    PWTouchableOpacityProps,
    PWView,
} from '@components/core'
import { CopyableText } from '@components/CopyableText'
import { ContactAvatar } from '@components/ContactAvatar'
import type { ContactAvatarVariant } from '@components/ContactAvatar/styles'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { AccountIcon } from '@modules/accounts/components/AccountIcon'
import { SvgProps } from 'react-native-svg'
import { useStyles } from './styles'
import {
    useAddressDisplay,
    type AddressDisplayType,
    type AddressFormat,
} from './useAddressDisplay'

export type AddressDisplayProps = {
    address: string
    addressFormat?: AddressFormat
    displayType?: AddressDisplayType
    showCopy?: boolean
    forceShowIcon?: boolean
    iconName?: IconName
    showSecondaryAddress?: boolean
    textProps?: PWTextProps
    iconProps?: SvgProps
    contactAvatarVariant?: ContactAvatarVariant
    /**
     * Node rendered to the right of the address content. When provided, the
     * row is not wrapped in `CopyableText` — only the trailing node is
     * interactive. Takes precedence over `showCopy`.
     */
    trailing?: ReactNode
} & PWTouchableOpacityProps

export const AddressDisplay = ({
    address,
    addressFormat = 'short',
    displayType = 'full',
    showCopy = true,
    forceShowIcon = false,
    iconName,
    showSecondaryAddress = false,
    textProps,
    iconProps,
    contactAvatarVariant = 'default',
    trailing,
    ...rest
}: AddressDisplayProps) => {
    const styles = useStyles()
    const {
        account,
        contact,
        nfdName,
        truncatedAddress,
        fallbackIconName,
        copyAddress,
        unifiedLabels,
    } = useAddressDisplay({
        address,
        addressFormat,
        displayType,
        showSecondaryAddress,
    })

    const isUnifiedLayout = !!iconName || showSecondaryAddress

    let content: ReactNode

    if (isUnifiedLayout) {
        const { primary, secondary } = unifiedLabels

        content = (
            <>
                {account ? (
                    <AccountIcon
                        account={account}
                        size='lg'
                    />
                ) : (
                    <PWIcon
                        name={iconName ?? fallbackIconName}
                        size='lg'
                    />
                )}
                <PWView style={styles.unifiedTextContainer}>
                    <PWText
                        variant={textProps?.variant ?? 'h4'}
                        numberOfLines={1}
                        ellipsizeMode='middle'
                        {...textProps}
                    >
                        {primary}
                    </PWText>
                    {!!secondary && (
                        <PWText
                            variant='caption'
                            style={styles.secondaryText}
                            numberOfLines={1}
                            ellipsizeMode='middle'
                        >
                            {secondary}
                        </PWText>
                    )}
                </PWView>
            </>
        )
    } else if (account) {
        content = (
            <AccountDisplay
                account={account}
                textProps={textProps}
                showChevron={false}
            />
        )
    } else if (contact) {
        const showSecondary = contact.name !== truncatedAddress
        const primaryText = (
            <PWText
                variant={textProps?.variant ?? 'h4'}
                numberOfLines={1}
                ellipsizeMode='tail'
                {...textProps}
                style={textProps?.style ?? styles.primaryText}
            >
                {contact.name}
            </PWText>
        )
        content = (
            <PWView style={styles.contactContainer}>
                <ContactAvatar
                    size='md'
                    contact={contact}
                    variant={contactAvatarVariant}
                />
                {showSecondary ? (
                    <PWView style={styles.addressTextStack}>
                        {primaryText}
                        <PWText
                            variant='caption'
                            style={styles.secondaryText}
                            numberOfLines={1}
                            ellipsizeMode='middle'
                        >
                            {truncatedAddress}
                        </PWText>
                    </PWView>
                ) : (
                    primaryText
                )}
            </PWView>
        )
    } else {
        const showAvatar = !!nfdName || forceShowIcon
        content = (
            <PWView style={styles.contactContainer}>
                {showAvatar && (
                    <ContactAvatar
                        size='md'
                        variant={contactAvatarVariant}
                    />
                )}
                {nfdName ? (
                    <PWView style={styles.addressTextStack}>
                        <PWText {...textProps}>{nfdName}</PWText>
                        <PWText
                            variant='caption'
                            style={styles.secondaryText}
                            numberOfLines={1}
                            ellipsizeMode='middle'
                        >
                            {truncatedAddress}
                        </PWText>
                    </PWView>
                ) : (
                    <PWText {...textProps}>{truncatedAddress}</PWText>
                )}
            </PWView>
        )
    }

    if (trailing) {
        return (
            <PWView
                {...rest}
                style={[styles.addressValueContainer, rest.style]}
            >
                {content}
                {trailing}
            </PWView>
        )
    }

    if (!showCopy) {
        return (
            <PWView
                {...rest}
                style={[styles.addressValueContainer, rest.style]}
            >
                {content}
            </PWView>
        )
    }

    return (
        <CopyableText
            {...rest}
            copyValue={address}
            style={[styles.addressValueContainer, rest.style]}
        >
            {content}
            <PWIcon
                name='copy'
                size='md'
                variant='secondary'
                {...iconProps}
                onPress={copyAddress}
            />
        </CopyableText>
    )
}
