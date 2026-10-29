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
import { useStyles } from './styles'
import { type TransactionListRow } from '@modules/transactions'

export type RowSeparatorProps = {
    leadingItem: TransactionListRow
    trailingItem: TransactionListRow
}

/**
 * Hairline between two transaction rows only. A date header brings its own
 * rules, so a separator either side of one would double up — the equivalent of
 * `SectionList`'s item-vs-section separator split, which a flat list collapses
 * into a single slot.
 */
export const RowSeparator = ({
    leadingItem,
    trailingItem,
}: RowSeparatorProps) => {
    const styles = useStyles()

    if (leadingItem.kind === 'header' || trailingItem.kind === 'header') {
        return null
    }

    return <PWView style={styles.separator} />
}
