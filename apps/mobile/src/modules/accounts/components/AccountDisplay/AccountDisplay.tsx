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
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import {
    getAccountDisplayName,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    PWIcon,
    PWText,
    PWTextProps,
    PWView,
    PWViewProps,
} from '@components/core'
import { useStyles } from './styles'

import { AccountIcon, AccountIconProps } from '../AccountIcon'
import { useMemo } from 'react'
import { useNfdForAddressQuery } from '@perawallet/wallet-core-nfd'
import { useAccountTypeLabel } from '@modules/accounts/hooks/useAccountTypeLabel'

export type AccountDisplayProps = {
    account?: WalletAccount
    iconProps?: Omit<AccountIconProps, 'account'>
    textProps?: PWTextProps
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
    iconProps,
    showChevron = true,
    textProps,
    noBorder,
    compact = false,
    showAccountType = false,
    ...rest
}: AccountDisplayProps) => {
    const { theme } = useTheme()
    const styles = useStyles({ noBorder })
    const displayName = useMemo(
        () => (account ? getAccountDisplayName(account) : 'No Account'),
        [account?.name, account?.address],
    )
    const address = useMemo(
        () => (account ? truncateAlgorandAddress(account?.address) : undefined),
        [account?.address],
    )

    const { data: nfdNames } = useNfdForAddressQuery(account?.address ?? '', {
        enabled: !!account?.address,
    })

    const nfdName = useMemo(() => nfdNames?.at(0)?.name, [nfdNames])

    const { label: accountTypeLabel } = useAccountTypeLabel(account)

    const hasName = Boolean(nfdName) || displayName !== address
    const showTypeAsSecondary =
        showAccountType && !hasName && Boolean(accountTypeLabel)
    const renderSecondary = hasName || showTypeAsSecondary
    const secondaryText = showTypeAsSecondary
        ? accountTypeLabel
        : (nfdName ?? address)

    return (
        <PWView
            {...rest}
            style={[styles.container, rest.style]}
        >
            {!!account && (
                <AccountIcon
                    account={account}
                    size='lg'
                    color={theme.colors.textMain}
                    {...iconProps}
                />
            )}
            <PWView style={styles.textContainer}>
                {!compact && (
                    <PWText
                        style={textProps?.style ?? styles.text}
                        variant={textProps?.variant ?? 'h4'}
                        numberOfLines={1}
                        ellipsizeMode='tail'
                    >
                        {displayName}
                    </PWText>
                )}
                {(compact || renderSecondary) && (
                    <PWText
                        style={styles.addressText}
                        variant='caption'
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
                />
            )}
        </PWView>
    )
}
