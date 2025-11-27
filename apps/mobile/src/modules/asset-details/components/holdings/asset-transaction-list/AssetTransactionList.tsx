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

import { useStyles } from './styles'
import PWView from '../../../../../components/common/view/PWView'
import { PeraAsset } from '@perawallet/wallet-core-assets'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
import PWButton from '../../../../../components/common/button/PWButton'
import { Text } from '@rneui/themed'
import EmptyView from '../../../../../components/common/empty-view/EmptyView'
import { FlashList } from "@shopify/flash-list";

type AssetTransactionListProps = {
    account: WalletAccount
    asset: PeraAsset
    children?: React.ReactNode
}

//TODO implement fully
const AssetTransactionList = ({ children }: AssetTransactionListProps) => {
    const styles = useStyles()

    // TODO: Replace with actual infinite query hook when added.
    const transactions: any[] = []
    const handleEndReached = () => {
        // fetchNextPage();
    }

    const renderItem = () => {
        return <Text>Transaction Item</Text>
    }

    return (
        <PWView style={styles.container}>
            <FlashList
                contentContainerStyle={styles.list}
                data={transactions}
                renderItem={renderItem}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.5}
                ListHeaderComponent={
                    <PWView style={styles.headerContainer}>
                        {children}
                        <PWView style={styles.header}>
                            <Text h4>Transactions</Text>
                            <PWView style={styles.actions}>
                                <PWButton
                                    title='Filter'
                                    variant='link'
                                    icon='sliders'
                                    paddingStyle='dense'
                                />
                                <PWButton
                                    title='CSV'
                                    variant='helper'
                                    icon='text-document'
                                    paddingStyle='dense'
                                />
                            </PWView>
                        </PWView>
                    </PWView>
                }
                ListEmptyComponent={<EmptyView
                    title='No Transactions'
                    body='There are no transactions to be displayed'
                />}
            />
        </PWView>
    )
}

export default AssetTransactionList
