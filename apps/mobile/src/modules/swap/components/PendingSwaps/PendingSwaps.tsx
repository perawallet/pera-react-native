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

import { PWListItemLayout, PWText, PWView } from '@components/core'
import { TransactionIcon } from '@components/TransactionIcon'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import { usePendingSwaps } from './usePendingSwaps'

export type PendingSwapsProps = {
    /** The network History is narrowed to; null is All. */
    shownScope: Nullable<ChainScope>
}

export const PendingSwaps = ({ shownScope }: PendingSwapsProps) => {
    const styles = useStyles()
    const { rows } = usePendingSwaps(shownScope)

    if (rows.length === 0) return null

    return (
        <PWView testID='pending_swaps'>
            {rows.map(row => (
                <PWListItemLayout
                    key={row.orderId}
                    testID={`pending_swap_${row.orderId}`}
                    style={styles.row}
                    align='top'
                    left={
                        <TransactionIcon
                            name='swap'
                            size='md'
                        />
                    }
                >
                    <PWView>
                        <PWText
                            variant='h4'
                            style={styles.title}
                        >
                            {row.pairLabel}
                        </PWText>
                        <PWText style={styles.status}>{row.statusText}</PWText>
                    </PWView>
                </PWListItemLayout>
            ))}
        </PWView>
    )
}
