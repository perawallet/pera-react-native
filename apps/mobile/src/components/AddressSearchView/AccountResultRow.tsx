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
    useAccountBalancesQuery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { ALGO_ASSET, ALGO_ASSET_ID } from '@perawallet/wallet-core-assets'
import { PWView } from '@components/core'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { PreferredCurrencyDisplay } from '@components/PreferredCurrencyDisplay'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { useStyles } from './styles'

type AccountResultRowProps = {
    account: WalletAccount
    showBalance: boolean
}

export const AccountResultRow = ({
    account,
    showBalance,
}: AccountResultRowProps) => {
    const styles = useStyles()
    const { accountBalances } = useAccountBalancesQuery([account], showBalance)
    const algoValue = accountBalances.get(account.address)?.algoValue

    if (!showBalance) {
        return (
            <AccountDisplay
                account={account}
                showChevron={false}
                style={styles.accountDisplay}
            />
        )
    }

    return (
        <PWView style={styles.accountRow}>
            <AccountDisplay
                account={account}
                showChevron={false}
                style={styles.accountDisplayInRow}
            />
            <PWView style={styles.balanceContainer}>
                <CurrencyDisplay
                    currency='ALGO'
                    value={algoValue}
                    precision={ALGO_ASSET.decimals}
                    minPrecision={2}
                    variant='bodyCompact'
                />
                <PreferredCurrencyDisplay
                    sourceAssetId={ALGO_ASSET_ID}
                    sourceAmount={algoValue}
                    precision={2}
                    minPrecision={2}
                    variant='bodyCompact'
                    style={styles.fiatBalance}
                />
            </PWView>
        </PWView>
    )
}
