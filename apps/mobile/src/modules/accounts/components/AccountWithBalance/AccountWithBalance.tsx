/*
 Copyright 2022-2026 Pera Wallet, LDA
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
    useAccountValueTotalsQuery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-shared'
import { PWView, type PWViewProps } from '@components/core'
import { useStyles } from './styles'

import { AccountDisplay } from '../AccountDisplay'
import { AssetAmount } from '@components/AssetAmount'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { PreferredAmount } from '@components/PreferredAmount'

export type AccountWithBalanceProps = {
    account: WalletAccount
    isHighlighted?: boolean
} & PWViewProps

export const AccountWithBalance = ({
    account,
    isHighlighted,
    ...rest
}: AccountWithBalanceProps) => {
    const styles = useStyles({ isHighlighted })
    const { accountValueTotals } = useAccountValueTotalsQuery([account], true)

    return (
        <PWView
            {...rest}
            style={[styles.container, rest.style]}
        >
            <AccountDisplay
                account={account}
                showChevron={false}
                showAccountType
            />
            <PWView style={styles.balanceContainer}>
                <AssetAmount
                    asset={ALGO_ASSET}
                    value={accountValueTotals.get(account.address)?.algoValue}
                    density='compact'
                    variant='bodyLarge'
                    weight={500}
                />

                <PreferredAmount
                    sourceAssetId={ALGO_ASSET_ID}
                    sourceAmount={
                        accountValueTotals.get(account.address)?.algoValue
                    }
                    density='compact'
                    variant='footnoteMedium'
                    weight={400}
                    style={styles.fiatBalance}
                />
            </PWView>
        </PWView>
    )
}
