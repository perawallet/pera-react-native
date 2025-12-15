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
import PWView from '@components/view/PWView'
import { PeraAsset } from '@perawallet/wallet-core-assets'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
import PWButton from '@components/button/PWButton'
import { Text } from '@rneui/themed'
import EmptyView from '@components/empty-view/EmptyView'
import { FlashList } from '@shopify/flash-list'
import { useLanguage } from '@hooks/language'

type AssetTransactionListProps = {
    account: WalletAccount
    asset: PeraAsset
    children?: React.ReactNode
}

//TODO implement fully
const AssetTransactionList = ({ children }: AssetTransactionListProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    // TODO: Replace with actual infinite query hook when added.
    const transactions: [] = []
    const handleEndReached = () => {
        // fetchNextPage();
    }

    const renderItem = () => {
        return <Text>{t('asset_details.transaction_list.label')}</Text>
    }

    return (
        <FlashList
            contentContainerStyle={styles.container}
            data={transactions}
            renderItem={renderItem}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            ListHeaderComponent={
                <PWView>
                    {children}
                    <PWView style={styles.header}>
                        <Text h4>
                            {t('asset_details.transaction_list.title')}
                        </Text>
                        <PWView style={styles.actions}>
                            <PWButton
                                title={t(
                                    'asset_details.transaction_list.filter',
                                )}
                                variant='link'
                                icon='sliders'
                                paddingStyle='dense'
                            />
                            <PWButton
                                title={t('asset_details.transaction_list.csv')}
                                variant='helper'
                                icon='text-document'
                                paddingStyle='dense'
                            />
                        </PWView>
                    </PWView>
                </PWView>
            }
            ListEmptyComponent={
                <EmptyView
                    style={styles.emptyView}
                    title={t('asset_details.transaction_list.empty_title')}
                    body={t('asset_details.transaction_list.empty_body')}
                />
            }
        />
    )
}

export default AssetTransactionList
