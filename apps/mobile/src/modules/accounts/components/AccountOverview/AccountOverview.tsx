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

import { AccountOverviewHeader } from './AccountOverviewHeader'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import { useStyles } from './styles'
import { useAccountOverview } from './useAccountOverview'
import { PWRefreshControl, PWView } from '@components/core'
import { AccountAssetList } from '../AccountAssetList'
import { AccountOverviewModalContext } from './AccountOverviewModalContext'

export type AccountOverviewProps = {
    account: WalletAccount
    chartVisible: boolean
}

export const AccountOverview = ({
    account,
    chartVisible,
}: AccountOverviewProps) => {
    const styles = useStyles()
    const { isLoading, isRefreshing, handleRefresh, contextValue } =
        useAccountOverview({
            account,
        })

    return (
        <AccountOverviewModalContext.Provider value={contextValue}>
            <PWView style={styles.container}>
                <AccountAssetList
                    account={account}
                    isLoading={isLoading}
                    refreshControl={
                        <PWRefreshControl
                            isRefreshing={isRefreshing}
                            onRefresh={handleRefresh}
                        />
                    }
                    header={
                        <AccountOverviewHeader
                            account={account}
                            chartVisible={chartVisible}
                            isLoading={isLoading}
                        />
                    }
                />
            </PWView>
        </AccountOverviewModalContext.Provider>
    )
}
