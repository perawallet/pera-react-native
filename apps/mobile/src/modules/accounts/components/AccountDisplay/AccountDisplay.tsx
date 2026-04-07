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
import { useNfdForAddress } from '@perawallet/wallet-core-nfd'

export type AccountDisplayProps = {
    account?: WalletAccount
    iconProps?: Omit<AccountIconProps, 'account'>
    textProps?: PWTextProps
    showChevron?: boolean
    noBorder?: boolean
    compact?: boolean
} & PWViewProps

export const AccountDisplay = ({
    account,
    iconProps,
    showChevron = true,
    textProps,
    noBorder,
    compact = false,
    ...rest
}: AccountDisplayProps) => {
    const { theme } = useTheme()
    const styles = useStyles({ noBorder })
    const displayName = useMemo(
        () => (account ? getAccountDisplayName(account) : 'No Account'),
        [account?.name, account?.address],
    )
    const address = useMemo(
        () =>
            account ? truncateAlgorandAddress(account?.address, 12) : undefined,
        [account?.address],
    )

    const { nfdName } = useNfdForAddress(account?.address ?? '', {
        enabled: !!account?.address,
    })

    const renderSecondary = useMemo(
        () => nfdName || displayName === address,
        [nfdName, displayName, address],
    )

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
                {renderSecondary && (
                    <PWText
                        style={styles.addressText}
                        variant='caption'
                        numberOfLines={1}
                        ellipsizeMode='middle'
                    >
                        {nfdName ?? address}
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
