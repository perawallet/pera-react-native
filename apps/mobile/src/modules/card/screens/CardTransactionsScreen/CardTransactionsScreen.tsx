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

import { SectionList } from 'react-native'
import { PWScreen } from '@components/core'
import { useCardTransactions } from './useCardTransactions'
import { useStyles } from './styles'

export const CardTransactionsScreen = () => {
    const styles = useStyles()
    const {
        sections,
        isLoading,
        isEmpty,
        handleLoadMore,
        renderItem,
        renderSectionHeader,
        keyExtractor,
        renderFooter,
        renderEmptyComponent,
    } = useCardTransactions()

    return (
        <PWScreen
            scroll='never'
            testID='card_transactions_screen'
        >
            <SectionList
                sections={sections}
                style={styles.list}
                showsVerticalScrollIndicator={false}
                renderItem={renderItem}
                renderSectionHeader={renderSectionHeader}
                keyExtractor={keyExtractor}
                contentContainerStyle={styles.listContent}
                stickySectionHeadersEnabled={false}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListEmptyComponent={
                    isEmpty || isLoading ? renderEmptyComponent() : null
                }
                ListFooterComponent={renderFooter}
            />
        </PWScreen>
    )
}
