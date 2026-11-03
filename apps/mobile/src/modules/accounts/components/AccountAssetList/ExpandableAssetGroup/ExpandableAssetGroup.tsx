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

import React, { type ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { AccountHoldingsLiteRow } from '@perawallet/wallet-core-accounts'
import { PWView } from '@components/core'
import { ExpandablePanel } from '@components/ExpandablePanel'
import {
    AssetGroupRow,
    groupedHoldingItemKey,
    type AssetFiatConverter,
    type AssetGroupItem,
} from '@modules/assets'
import { useExpandableAssetGroup } from './useExpandableAssetGroup'
import { useStyles } from './styles'

export type ExpandableAssetGroupProps = {
    item: AssetGroupItem<AccountHoldingsLiteRow>
    convertFiat: AssetFiatConverter
    onToggleExpanded: () => void
    renderMember: (holding: AccountHoldingsLiteRow) => ReactNode
    headerStyle?: StyleProp<ViewStyle>
}

export const ExpandableAssetGroup = ({
    item,
    convertFiat,
    onToggleExpanded,
    renderMember,
    headerStyle,
}: ExpandableAssetGroupProps) => {
    const styles = useStyles()
    const { shouldRenderMembers } = useExpandableAssetGroup({
        isExpanded: item.isExpanded,
    })

    return (
        <PWView>
            <AssetGroupRow
                item={item}
                convertFiat={convertFiat}
                onToggleExpanded={onToggleExpanded}
                style={headerStyle}
            />
            <ExpandablePanel isExpanded={item.isExpanded}>
                {shouldRenderMembers
                    ? item.members.map(({ holding }, index) => (
                          <React.Fragment
                              key={groupedHoldingItemKey({
                                  kind: 'holding',
                                  holding,
                              })}
                          >
                              {index > 0 ? (
                                  <PWView style={styles.separator} />
                              ) : null}
                              {renderMember(holding)}
                          </React.Fragment>
                      ))
                    : null}
            </ExpandablePanel>
        </PWView>
    )
}
