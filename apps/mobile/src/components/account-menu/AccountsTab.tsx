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

import PWView from '../common/view/PWView'
import AccountIcon from '../accounts/account-icon/AccountIcon'
import PWTouchableOpacity from '../common/touchable-opacity/PWTouchableOpacity'
import {
    getAccountDisplayName,
    useAllAccounts,
    useSelectedAccountAddress,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useStyles } from './styles'
import { Text, useTheme } from '@rneui/themed'
import PWButton from '../common/button/PWButton'

type AccountsTabProps = {
    onSelected: (account: WalletAccount) => void
}
const AccountsTab = (props: AccountsTabProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const accounts = useAllAccounts()
    const { selectedAccountAddress, setSelectedAccountAddress } =
        useSelectedAccountAddress()

    const getRouteName = (account?: WalletAccount): string => {
        return account ? getAccountDisplayName(account) : 'Account'
    }

    const getWalletIcon = (acct: WalletAccount) => {
        return (
            <AccountIcon
                account={acct}
                color={
                    acct.address === selectedAccountAddress
                        ? theme.colors.secondary
                        : theme.colors.textMain
                }
            />
        )
    }

    const handleTap = (acct: WalletAccount) => {
        setSelectedAccountAddress(acct.address)
        props?.onSelected?.(acct)
    }
    return (
        <>
            <PWView style={styles.titleBar}>
                <PWView style={styles.titleBarButtonContainer}>
                    <PWButton
                        variant='helper'
                        icon='plus'
                        title='Add Account'
                        paddingStyle='dense'
                    />
                    <PWButton
                        variant='link'
                        icon='list-arrow-down'
                        title='Sort'
                        paddingStyle='dense'
                    />
                </PWView>
            </PWView>
            <PWView style={styles.accountContainer}>
                {accounts.map(acct => (
                    <PWTouchableOpacity
                        key={acct.address}
                        style={
                            acct.address === selectedAccountAddress
                                ? styles.activeItem
                                : styles.passiveItem
                        }
                        onPress={() => handleTap(acct)}
                    >
                        {getWalletIcon(acct)}
                        <Text
                            h4
                            h4Style={
                                acct.address === selectedAccountAddress
                                    ? styles.activeLabel
                                    : styles.passiveLabel
                            }
                        >
                            {getRouteName(acct)}
                        </Text>
                    </PWTouchableOpacity>
                ))}
            </PWView>
        </>
    )
}
export default AccountsTab
