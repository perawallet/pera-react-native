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
                {/* No separator between members: each one's network header divides them. */}
                {shouldRenderMembers
                    ? item.members.map(({ holding }) => (
                          <React.Fragment
                              key={groupedHoldingItemKey({
                                  kind: 'holding',
                                  holding,
                              })}
                          >
                              {renderMember(holding)}
                          </React.Fragment>
                      ))
                    : null}
            </ExpandablePanel>
        </PWView>
    )
}
