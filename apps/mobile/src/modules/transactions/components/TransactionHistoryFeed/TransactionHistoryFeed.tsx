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

import type { HistoryFeedProps } from '../../hooks/history/useMergedTransactionHistoryRows'
import { useTransactionHistoryFeed } from './useTransactionHistoryFeed'

export type TransactionHistoryFeedProps = HistoryFeedProps

/**
 * Reads one network's history for `useMergedTransactionHistoryRows` and
 * renders nothing; the merged list renders the rows.
 */
export const TransactionHistoryFeed = (props: TransactionHistoryFeedProps) => {
    useTransactionHistoryFeed(props)
    return null
}
