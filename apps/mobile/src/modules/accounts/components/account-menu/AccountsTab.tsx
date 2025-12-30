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

import PWView from '@components/view/PWView'
import PWTouchableOpacity from '@components/touchable-opacity/PWTouchableOpacity'
import {
    useAllAccounts,
    useSelectedAccountAddress,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import PWButton from '@components/button/PWButton'
import { useLanguage } from '@hooks/language'
import { useStyles } from './styles'
import AccountWithBalance from '../account-with-balance/AccountWithBalance'

type AccountsTabProps = {
    onSelected: (account: WalletAccount) => void
}
const AccountsTab = (props: AccountsTabProps) => {
    const styles = useStyles()
    const accounts = useAllAccounts()
    const { selectedAccountAddress, setSelectedAccountAddress } =
        useSelectedAccountAddress()
    const { t } = useLanguage()

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
                        title={t('account_menu.add_account')}
                        paddingStyle='dense'
                    />
                    <PWButton
                        variant='link'
                        icon='list-arrow-down'
                        title={t('account_menu.sort')}
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
                        <AccountWithBalance account={acct} />
                    </PWTouchableOpacity>
                ))}
            </PWView>
        </>
    )
}
export default AccountsTab
