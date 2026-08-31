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

import { useTheme } from '@rneui/themed'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    PWIcon,
    type PWIconProps,
    PWImage,
    PWText,
    type PWTextProps,
    PWView,
    type PWViewProps,
} from '@components/core'
import peraCardImage from '@assets/images/pera-card.png'
import { useStyles } from './styles'
import { useAccountDisplay } from './useAccountDisplay'

import { AccountIcon, type AccountIconProps } from '../AccountIcon'

/** Pera Card identity rendered in place of an account (header trigger). */
export type AccountDisplayCard = {
    /** Primary label, e.g. "Pera Card". */
    title: string
    /** Secondary label, e.g. "Linked to Main account". */
    subtitle: string
}

export type AccountDisplayProps = {
    account?: WalletAccount
    /**
     * When set, render the Pera Card presentation (card art + title/subtitle)
     * instead of an account. Takes precedence over `account`.
     */
    card?: AccountDisplayCard
    iconProps?: Omit<AccountIconProps, 'account'>
    textProps?: PWTextProps
    chevronProps?: Partial<PWIconProps>
    showChevron?: boolean
    noBorder?: boolean
    compact?: boolean
    /**
     * When set, accounts shown by their truncated address (no custom name or
     * NFD) display the account type on the secondary line instead.
     */
    showAccountType?: boolean
} & PWViewProps

export const AccountDisplay = ({
    account,
    card,
    iconProps,
    chevronProps,
    showChevron = true,
    textProps,
    noBorder,
    compact = false,
    showAccountType = false,
    ...rest
}: AccountDisplayProps) => {
    const { theme } = useTheme()
    const styles = useStyles({ noBorder })
    const iconSize = iconProps?.size ?? 'xl'
    const {
        displayName,
        secondaryText,
        renderSecondary,
        showTypeAsSecondary,
        showBackupBadge,
    } = useAccountDisplay({ account, compact, showAccountType, iconSize })

    if (card) {
        return (
            <PWView
                {...rest}
                style={[styles.container, rest.style]}
            >
                <PWImage
                    source={peraCardImage}
                    style={styles.cardThumb}
                    resizeMode='cover'
                />
                <PWView style={styles.textContainer}>
                    <PWText
                        style={textProps?.style ?? styles.text}
                        variant={textProps?.variant ?? 'bodyLarge'}
                        weight={textProps?.variant ? undefined : 500}
                        numberOfLines={1}
                    >
                        {card.title}
                    </PWText>
                    <PWText
                        style={styles.addressText}
                        variant='body'
                        numberOfLines={1}
                    >
                        {card.subtitle}
                    </PWText>
                </PWView>
                {showChevron && (
                    <PWIcon
                        variant='secondary'
                        name='chevron-down'
                        {...chevronProps}
                    />
                )}
            </PWView>
        )
    }

    return (
        <PWView
            {...rest}
            style={[styles.container, rest.style]}
        >
            {!!account && (
                <PWView>
                    <AccountIcon
                        account={account}
                        size='xl'
                        color={theme.colors.textMain}
                        {...iconProps}
                    />
                    {showBackupBadge && (
                        <PWView
                            style={styles.backupBadge}
                            testID='account_backup_badge'
                        >
                            <PWIcon
                                name='warning'
                                variant='error'
                                size='sm'
                            />
                        </PWView>
                    )}
                </PWView>
            )}
            <PWView style={styles.textContainer}>
                {!compact && (
                    <PWText
                        style={textProps?.style ?? styles.text}
                        variant={textProps?.variant ?? 'bodyLarge'}
                        weight={textProps?.variant ? undefined : 500}
                        numberOfLines={1}
                        ellipsizeMode='middle'
                    >
                        {displayName}
                    </PWText>
                )}
                {renderSecondary && (
                    <PWText
                        style={styles.addressText}
                        variant='body'
                        weight={400}
                        numberOfLines={1}
                        ellipsizeMode={showTypeAsSecondary ? 'tail' : 'middle'}
                    >
                        {secondaryText}
                    </PWText>
                )}
            </PWView>
            {showChevron && (
                <PWIcon
                    variant='secondary'
                    name='chevron-down'
                    {...chevronProps}
                />
            )}
        </PWView>
    )
}
