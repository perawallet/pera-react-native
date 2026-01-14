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

import { Text, TextProps, useTheme } from '@rneui/themed'
import {
    getAccountDisplayName,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import PWView, { PWViewProps } from '@components/PWView'
import { useStyles } from './styles'

import AccountIcon, { AccountIconProps } from '../account-icon/AccountIcon'
import PWIcon from '@components/PWIcon'

type AccountDisplayProps = {
    account?: WalletAccount
    iconProps?: Omit<AccountIconProps, 'account'>
    textProps?: TextProps
    showChevron?: boolean
} & PWViewProps

const AccountDisplay = ({
    account,
    iconProps,
    showChevron = true,
    textProps,
    ...rest
}: AccountDisplayProps) => {
    const { theme } = useTheme()
    const styles = useStyles()
    const displayName = account ? getAccountDisplayName(account) : 'No Account'

    return (
        <PWView
            {...rest}
            style={[styles.container, rest.style]}
        >
            {!!account && (
                <AccountIcon
                    account={account}
                    color={theme.colors.textMain}
                    {...iconProps}
                />
            )}
            <Text
                {...textProps}
                h4Style={textProps ? textProps.h4Style : styles.text}
                h4={!textProps}
            >
                {displayName}
            </Text>
            {showChevron && (
                <PWIcon
                    variant='secondary'
                    name='chevron-down'
                />
            )}
        </PWView>
    )
}

export default AccountDisplay
