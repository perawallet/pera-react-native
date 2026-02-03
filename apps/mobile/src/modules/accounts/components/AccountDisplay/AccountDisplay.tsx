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

export type AccountDisplayProps = {
    account?: WalletAccount
    iconProps?: Omit<AccountIconProps, 'account'>
    textProps?: PWTextProps
    showChevron?: boolean
    noBorder?: boolean
} & PWViewProps

export const AccountDisplay = ({
    account,
    iconProps,
    showChevron = true,
    textProps,
    noBorder,
    ...rest
}: AccountDisplayProps) => {
    const { theme } = useTheme()
    const styles = useStyles({ noBorder })
    const displayName = account ? getAccountDisplayName(account) : 'No Account'

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
                <PWText
                    style={textProps?.style ?? styles.text}
                    variant={textProps?.variant ?? 'h4'}
                    numberOfLines={1}
                    ellipsizeMode='tail'
                >
                    {displayName}
                </PWText>
                {!!account && (
                    <PWText
                        style={styles.addressText}
                        variant='caption'
                        numberOfLines={1}
                        ellipsizeMode='middle'
                    >
                        {truncateAlgorandAddress(account.address, 12)}
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
