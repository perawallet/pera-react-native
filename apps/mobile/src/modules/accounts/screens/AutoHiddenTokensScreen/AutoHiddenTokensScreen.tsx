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

import { PWFlatList, PWScreen, PWText } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import type { AccountHoldingsLiteRow } from '@perawallet/wallet-core-accounts'
import { AssetRowSkeleton } from '@modules/assets'
import { HideTokenRow } from '../../components/HideTokenRow'
import { useStyles } from './styles'
import { useAutoHiddenTokensScreen } from './useAutoHiddenTokensScreen'

const SKELETON_ROWS = 4

const rowKey = ({ scope, assetId }: AccountHoldingsLiteRow): string =>
    `${scope.chainId}/${scope.networkId}/${assetId}`

export const AutoHiddenTokensScreen = () => {
    const styles = useStyles()
    const { rows, isPending, showsNetwork, handleUnhide, t } =
        useAutoHiddenTokensScreen()

    return (
        <PWScreen
            testID='auto_hidden_tokens_screen'
            scroll='never'
        >
            <PWFlatList
                data={rows}
                keyExtractor={rowKey}
                renderItem={({ item }) => (
                    <HideTokenRow
                        row={item}
                        isHidden
                        isLocked={false}
                        showsNetwork={showsNetwork}
                        onToggle={handleUnhide}
                    />
                )}
                ListHeaderComponent={
                    <PWText
                        variant='caption'
                        style={styles.description}
                    >
                        {t('token_visibility.auto_hidden_description')}
                    </PWText>
                }
                ListEmptyComponent={
                    isPending ? (
                        <AssetRowSkeleton count={SKELETON_ROWS} />
                    ) : (
                        <EmptyView
                            title={t(
                                'token_visibility.auto_hidden_empty_title',
                            )}
                            body=''
                        />
                    )
                }
            />
        </PWScreen>
    )
}
