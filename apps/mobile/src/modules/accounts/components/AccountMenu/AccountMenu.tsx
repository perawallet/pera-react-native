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

import { PWView } from '@components/core'
import { useStyles } from './styles'
import { PortfolioView } from '../PortfolioView'
import { AccountsTab } from './AccountsTab'
import { WalletAccount } from '@perawallet/wallet-core-accounts'

export type AccountMenuProps = {
    onSelected: (account: WalletAccount) => void
}
export const AccountMenu = (props: AccountMenuProps) => {
    const styles = useStyles()

    return (
        <PWView style={styles.container}>
            <PortfolioView style={styles.portfolioContainer} />
            <AccountsTab onSelected={props.onSelected} />
        </PWView>
    )
}
