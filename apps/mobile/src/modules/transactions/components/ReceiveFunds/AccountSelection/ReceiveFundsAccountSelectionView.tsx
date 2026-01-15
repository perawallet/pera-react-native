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

import { PWHeader, PWTouchableOpacity, PWView } from '@components/core'
import { useLanguage } from '@hooks/language'
import { useAllAccounts, WalletAccount } from '@perawallet/wallet-core-accounts'
import { Text } from '@rneui/themed'
import { useStyles } from './styles'
import { AccountWithBalance } from '@modules/accounts/components/AccountWithBalance'

type ReceiveFundsAccountSelectionViewProps = {
    onSelected: (account: WalletAccount) => void
    onClose: () => void
}

export const ReceiveFundsAccountSelectionView = ({
    onSelected,
    onClose,
}: ReceiveFundsAccountSelectionViewProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const accounts = useAllAccounts()

    const handleTap = (acct: WalletAccount) => {
        onSelected(acct)
    }

    return (
        <PWView style={styles.container}>
            <PWHeader
                leftIcon='cross'
                onLeftPress={onClose}
            >
                <Text>{t('receive_funds.account_selection.title')}</Text>
            </PWHeader>
            {accounts.map(acct => (
                <PWTouchableOpacity
                    key={acct.address}
                    style={styles.accountItem}
                    onPress={() => handleTap(acct)}
                >
                    <AccountWithBalance account={acct} />
                </PWTouchableOpacity>
            ))}
        </PWView>
    )
}
