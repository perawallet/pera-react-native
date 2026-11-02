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

import { PWView } from '@components/core'
import React from 'react'
import type { AccountAssetListItem } from '../useAccountAssetList'
import { useStyles } from './styles'

export type ItemSeparatorProps = {
    leadingItem?: AccountAssetListItem
    trailingItem?: AccountAssetListItem
}

export const ItemSeparator = ({
    leadingItem,
    trailingItem,
}: ItemSeparatorProps) => {
    const styles = useStyles()

    // An expanded group's members hang directly under its header.
    if (
        leadingItem?.kind === 'group' &&
        trailingItem?.kind === 'holding' &&
        trailingItem.isGroupMember
    ) {
        return null
    }

    return <PWView style={styles.separator} />
}
