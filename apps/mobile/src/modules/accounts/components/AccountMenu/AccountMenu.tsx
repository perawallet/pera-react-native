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

import {
    PWButton,
    PWFlatList,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { AccountWithBalance } from '../AccountWithBalance'
import { PortfolioView } from '../PortfolioView'
import { useAccountMenu } from './useAccountMenu'

export type AccountMenuProps = {
    onSelected: (account: WalletAccount) => void
}

export const AccountMenu = (props: AccountMenuProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { accounts, selectedAccountAddress, handleTap } =
        useAccountMenu(props)

    return (
        <PWView style={styles.container}>
            <PortfolioView style={styles.portfolioContainer} />

            <PWView style={styles.mainContent}>
                <PWView style={styles.titleBar}>
                    <PWText
                        variant='h3'
                        style={styles.activeTitle}
                    >
                        {t('account_menu.title')}
                    </PWText>
                    <PWView style={styles.titleBarButtonContainer}>
                        <PWButton
                            variant='link'
                            icon='list-arrow-down'
                            title={t('account_menu.sort')}
                            paddingStyle='dense'
                        />
                        <PWButton
                            variant='helper'
                            icon='plus'
                            paddingStyle='dense'
                        />
                    </PWView>
                </PWView>

                <PWFlatList<WalletAccount>
                    data={accounts}
                    keyExtractor={item => item.address}
                    renderItem={({ item: acct }) => (
                        <PWTouchableOpacity onPress={() => handleTap(acct)}>
                            <AccountWithBalance
                                account={acct}
                                isHighlighted={
                                    acct.address === selectedAccountAddress
                                }
                            />
                        </PWTouchableOpacity>
                    )}
                    ItemSeparatorComponent={ListSeparator}
                    showsVerticalScrollIndicator={false}
                />
            </PWView>
        </PWView>
    )
}

const ListSeparator = () => {
    const styles = useStyles()

    return <PWView style={styles.listSeparator} />
}
