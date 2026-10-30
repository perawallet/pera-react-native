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

import type { ReactNode } from 'react'
import {
    type IconName,
    PWIcon,
    PWText,
    type PWTextProps,
    type PWTouchableOpacityProps,
    PWView,
} from '@components/core'
import { dedupeSecondaryLabel } from '@perawallet/wallet-core-shared'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { CopyableText } from '@components/CopyableText'
import { ContactAvatar } from '@components/ContactAvatar'
import type { ContactAvatarVariant } from '@components/ContactAvatar/styles'
import { AccountDisplay } from '@components/AccountDisplay'
import { AccountIcon } from '@components/AccountIcon'
import { ChainAvatarBadge } from '@modules/chain-ui/icon'
import type { SvgProps } from 'react-native-svg'
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
    /**
     * Sit copy/trailing right after the text instead of filling the row and
     * pushing them to the far right.
     */
    hugContent?: boolean
    /** The address's chain; the selected Algorand scope when unset. */
    scope?: ChainScope
    /** Pins the address's chain icon to the avatar's bottom-left corner. Not drawn by the unified layout. */
    showChainBadge?: boolean
    /**
     * How the address reads when no account, contact or NFD names it;
     * `addressFormat` when unset. `full` wraps instead of truncating, so an
     * unknown address can be compared in full.
     */
    unnamedAddressFormat?: AddressFormat
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
    hugContent = false,
    scope,
    showChainBadge = false,
    unnamedAddressFormat,
    ...rest
}: AddressDisplayProps) => {
    const styles = useStyles({ hugContent })
    const {
        chainId,
        account,
        contact,
        nfdName,
        truncatedAddress,
        unnamedAddress,
        fallbackIconName,
        copyAddress,
        unifiedLabels,
    } = useAddressDisplay({
        address,
        addressFormat,
        displayType,
        showSecondaryAddress,
        scope,
        unnamedAddressFormat,
    })

    const isUnifiedLayout = !!iconName || showSecondaryAddress
    const chainBadge = showChainBadge ? (
        <ChainAvatarBadge chainId={chainId} />
    ) : null

    let content: ReactNode

    if (isUnifiedLayout) {
        const { primary, secondary } = unifiedLabels

        content = (
            <PWView style={styles.contactContainer}>
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
                        variant={textProps?.variant ?? 'bodyLarge'}
                        weight={textProps?.variant ? undefined : 500}
                        truncate
                        ellipsizeMode='middle'
                        {...textProps}
                    >
                        {primary}
                    </PWText>
                    {!!secondary && (
                        <PWText
                            variant='footnoteMedium'
                            weight={400}
                            style={styles.secondaryText}
                            truncate
                            ellipsizeMode='middle'
                        >
                            {secondary}
                        </PWText>
                    )}
                </PWView>
            </PWView>
        )
    } else if (account) {
        content = (
            <AccountDisplay
                account={account}
                textProps={textProps}
                showChevron={false}
                chainId={scope?.chainId}
                showChainBadge={showChainBadge}
            />
        )
    } else if (contact) {
        const showSecondary = Boolean(
            dedupeSecondaryLabel(contact.name, truncatedAddress),
        )
        const primaryText = (
            <PWText
                variant={textProps?.variant ?? 'bodyLarge'}
                weight={textProps?.variant ? undefined : 500}
                truncate
                {...textProps}
                style={textProps?.style ?? styles.primaryText}
            >
                {contact.name}
            </PWText>
        )
        content = (
            <PWView style={styles.contactContainer}>
                <PWView>
                    <ContactAvatar
                        size='md'
                        contact={contact}
                        variant={contactAvatarVariant}
                    />
                    {chainBadge}
                </PWView>
                {showSecondary ? (
                    <PWView style={styles.addressTextStack}>
                        {primaryText}
                        <PWText
                            variant='footnoteMedium'
                            weight={400}
                            style={styles.secondaryText}
                            truncate
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
                    <PWView>
                        <ContactAvatar
                            size='md'
                            variant={contactAvatarVariant}
                        />
                        {chainBadge}
                    </PWView>
                )}
                {nfdName ? (
                    <PWView style={styles.addressTextStack}>
                        <PWText
                            variant={textProps?.variant ?? 'bodyLarge'}
                            weight={textProps?.variant ? undefined : 500}
                            {...textProps}
                            truncate
                        >
                            {nfdName}
                        </PWText>
                        <PWText
                            variant='footnoteMedium'
                            weight={400}
                            style={styles.secondaryText}
                            truncate
                            ellipsizeMode='middle'
                        >
                            {truncatedAddress}
                        </PWText>
                    </PWView>
                ) : (
                    <PWText
                        variant={textProps?.variant ?? 'bodyLarge'}
                        weight={textProps?.variant ? undefined : 500}
                        {...textProps}
                        style={[styles.unnamedAddress, textProps?.style]}
                        truncate={unnamedAddressFormat !== 'full'}
                        ellipsizeMode='middle'
                    >
                        {unnamedAddress}
                    </PWText>
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
                <PWView style={styles.contentContainer}>{content}</PWView>
                <PWView style={styles.copyIconContainer}>{trailing}</PWView>
            </PWView>
        )
    }

    if (!showCopy) {
        return (
            <PWView
                {...rest}
                style={[styles.addressValueContainer, rest.style]}
            >
                <PWView style={styles.contentContainer}>{content}</PWView>
            </PWView>
        )
    }

    return (
        <CopyableText
            {...rest}
            copyValue={address}
            style={[styles.addressValueContainer, rest.style]}
        >
            <PWView style={styles.contentContainer}>{content}</PWView>
            <PWView style={styles.copyIconContainer}>
                <PWIcon
                    name='copy'
                    size='md'
                    variant='secondary'
                    {...iconProps}
                    onPress={copyAddress}
                />
            </PWView>
        </CopyableText>
    )
}
