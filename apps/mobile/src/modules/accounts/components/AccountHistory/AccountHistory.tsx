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
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import React from 'react'
import { KeyboardAvoidingView } from 'react-native'
import { useStyles } from './styles'

const TAB_AND_HEADER_HEIGHT = 100

export type AccountHistoryProps = {
    scrollEnabled?: boolean
}

export const AccountHistory = ({ scrollEnabled }: AccountHistoryProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const renderItem = () => {
        return (
            <PWView style={styles.itemContainer}>
                <PWText>Transaction Item</PWText>
            </PWView>
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
                activeOpacity={1}
            >
                <PWFlatList
                    data={[]}
                    renderItem={renderItem}
                    scrollEnabled={scrollEnabled}
                    keyExtractor={(_, index) => index.toString()}
                    automaticallyAdjustKeyboardInsets
                    keyboardDismissMode='interactive'
                    contentContainerStyle={styles.rootContainer}
                    ListHeaderComponent={
                        <PWView style={styles.headerContainer}>
                            <PWView style={styles.titleBar}>
                                <PWText
                                    style={styles.title}
                                    variant='h4'
                                >
                                    {t('asset_details.transaction_list.title')}
                                </PWText>
                                <PWView style={styles.titleBarButtonContainer}>
                                    <PWButton
                                        icon='sliders'
                                        title={t(
                                            'asset_details.transaction_list.filter',
                                        )}
                                        variant='helper'
                                        style={styles.transparentButton}
                                        paddingStyle='dense'
                                    />
                                    <PWButton
                                        icon='document-download'
                                        title={t(
                                            'asset_details.transaction_list.csv',
                                        )}
                                        variant='helper'
                                        paddingStyle='dense'
                                    />
                                </PWView>
                            </PWView>
                        </PWView>
                    }
                    ListEmptyComponent={
                        <EmptyView
                            title={t(
                                'asset_details.transaction_list.empty_title',
                            )}
                            body={t(
                                'asset_details.transaction_list.empty_body',
                            )}
                        />
                    }
                    ListFooterComponent={<PWView style={styles.footer} />}
                />
            </PWTouchableOpacity>
        </KeyboardAvoidingView>
    )
}
