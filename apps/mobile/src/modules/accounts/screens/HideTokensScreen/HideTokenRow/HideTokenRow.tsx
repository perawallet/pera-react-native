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

import { PWButton, PWText, PWView } from '@components/core'
import {
    assetFromHoldingLiteRow,
    type AccountHoldingsLiteRow,
} from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { AssetItemView, AssetRowSkeleton } from '@modules/assets'
import { ChainLabel } from '@modules/chain-ui/icon'
import { useStyles } from './styles'

export type HideTokenRowProps = {
    row: AccountHoldingsLiteRow
    isHidden: boolean
    /** The suspicious filter keeps it out, so there is no toggle; the row says why. */
    isLocked: boolean
    /** Names the token's network under it. */
    showsNetwork: boolean
    onToggle: (row: AccountHoldingsLiteRow) => void
}

export const HideTokenRow = ({
    row,
    isHidden,
    isLocked,
    showsNetwork,
    onToggle,
}: HideTokenRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { chainId } = row.scope
    const asset = assetFromHoldingLiteRow(row, chainId)

    if (!asset) return <AssetRowSkeleton style={styles.row} />

    return (
        <AssetItemView
            asset={asset}
            chainId={chainId}
            right={
                isLocked ? undefined : (
                    <PWButton
                        variant='link'
                        title={t(
                            isHidden
                                ? 'token_visibility.unhide_action'
                                : 'token_visibility.hide_action',
                        )}
                        onPress={() => onToggle(row)}
                        testID={`hide_tokens_toggle_${row.assetId}`}
                    />
                )
            }
            footer={
                showsNetwork || isLocked ? (
                    <PWView style={styles.footer}>
                        {showsNetwork ? <ChainLabel chainId={chainId} /> : null}
                        {isLocked ? (
                            <PWText
                                variant='caption'
                                style={styles.note}
                                testID={`hide_tokens_filtered_${row.assetId}`}
                            >
                                {t('token_visibility.filtered_note')}
                            </PWText>
                        ) : null}
                    </PWView>
                ) : undefined
            }
            style={styles.row}
        />
    )
}
