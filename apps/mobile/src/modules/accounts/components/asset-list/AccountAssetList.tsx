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

import PWTouchableOpacity from '@components/touchable-opacity/PWTouchableOpacity'
import AccountAssetItemView from '@modules/assets/components/asset-item/AccountAssetItemView'
import PWView from '@components/view/PWView'
import { PropsWithChildren, useMemo, useState } from 'react'
import { useStyles } from './styles'
import { Text } from '@rneui/themed'

import SearchInput from '@components/search-input/SearchInput'
import PWButton from '@components/button/PWButton'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    useAccountBalancesQuery,
    WalletAccount,
    AssetWithAccountBalance,
} from '@perawallet/wallet-core-accounts'
import { FlashList } from '@shopify/flash-list'
import EmptyView from '@components/empty-view/EmptyView'
import LoadingView from '@components/loading/LoadingView'
import { useLanguage } from '@hooks/language'
import { GestureResponderEvent, KeyboardAvoidingView } from 'react-native'
import ExpandablePanel from '@components/expandable-panel/ExpandablePanel'
import { useModalState } from '@hooks/modal-state'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'

const TAB_AND_HEADER_HEIGHT = 100
type AccountAssetListProps = {
    account: WalletAccount
    scrollEnabled?: boolean
} & PropsWithChildren

//TODO implement links and buttons
const AccountAssetList = ({
    account,
    children,
    scrollEnabled,
}: AccountAssetListProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const headerState = useModalState()
    const [searchFilter, setSearchFilter] = useState('')
    const { accountBalances, isPending } = useAccountBalancesQuery([account])
    const { data: assets } = useAssetsQuery()
    const balanceData = useMemo(
        () => accountBalances.get(account.address),
        [accountBalances, account.address],
    )
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()

    const balances = useMemo(() => {
        if (!balanceData) {
            return []
        }
        const searchTerm = searchFilter.toLowerCase()

        return balanceData.assetBalances.filter(asset => {
            const assetInfo = assets?.get(asset.assetId)
            return (
                (assetInfo?.unitName?.toLowerCase().includes(searchTerm) ||
                    assetInfo?.name?.toLowerCase().includes(searchTerm)) ??
                false
            )
        })
    }, [balanceData, searchFilter, assets])

    const goToAssetScreen = (
        event: GestureResponderEvent,
        asset: AssetWithAccountBalance,
    ) => {
        event.stopPropagation()
        headerState.open()
        navigation.navigate('AssetDetails', {
            assetId: asset.assetId,
        })
    }

    const renderItem = ({ item }: { item: AssetWithAccountBalance }) => {
        return (
            <PWTouchableOpacity
                style={styles.itemContainer}
                onPress={event => goToAssetScreen(event, item)}
                key={`asset-key-${item.assetId}`}
            >
                <AccountAssetItemView accountBalance={item} />
            </PWTouchableOpacity>
        )
    }

    return (
        <KeyboardAvoidingView
            keyboardVerticalOffset={TAB_AND_HEADER_HEIGHT}
            enabled
            behavior='padding'
            style={styles.keyboardAvoidingViewContainer}
        >
            <PWTouchableOpacity
                style={styles.keyboardAvoidingViewContainer}
                onPress={headerState.open}
            >
                <FlashList
                    data={balances}
                    renderItem={renderItem}
                    scrollEnabled={scrollEnabled}
                    keyExtractor={item => item.assetId}
                    automaticallyAdjustKeyboardInsets
                    keyboardDismissMode='interactive'
                    contentContainerStyle={styles.rootContainer}
                    ListHeaderComponent={
                        <PWView style={styles.headerContainer}>
                            <ExpandablePanel expanded={headerState.isOpen}>
                                {children}
                                <PWView style={styles.titleBar}>
                                    <Text
                                        style={styles.title}
                                        h4
                                    >
                                        {t('account_details.assets.title')}
                                    </Text>
                                    <PWView
                                        style={styles.titleBarButtonContainer}
                                    >
                                        <PWButton
                                            icon='sliders'
                                            variant='helper'
                                            paddingStyle='dense'
                                        />
                                        <PWButton
                                            icon='plus'
                                            title={t(
                                                'account_details.assets.add_asset',
                                            )}
                                            variant='helper'
                                            paddingStyle='dense'
                                        />
                                    </PWView>
                                </PWView>
                            </ExpandablePanel>
                            <SearchInput
                                onFocus={headerState.close}
                                placeholder={t(
                                    'account_details.assets.search_placeholder',
                                )}
                                onChangeText={setSearchFilter}
                            />
                        </PWView>
                    }
                    ListEmptyComponent={
                        <EmptyView
                            title={
                                searchFilter?.length
                                    ? t('account_details.assets.nomatch_title')
                                    : t('account_details.assets.empty_title')
                            }
                            body={
                                searchFilter?.length
                                    ? t('account_details.assets.nomatch_body')
                                    : t('account_details.assets.empty_body')
                            }
                        />
                    }
                    ListFooterComponent={
                        isPending ? (
                            <PWView style={styles.footer}>
                                <LoadingView
                                    variant='skeleton'
                                    size='sm'
                                    count={3}
                                />
                            </PWView>
                        ) : (
                            <PWView style={styles.footer} />
                        )
                    }
                />
            </PWTouchableOpacity>
        </KeyboardAvoidingView>
    )
}

export default AccountAssetList
