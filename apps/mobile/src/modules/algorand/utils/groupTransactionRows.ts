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

import {
    readAlgorandNative,
    type AlgorandTransactionView,
} from '@perawallet/wallet-core-chain-algorand/blockchain'
import type { TransactionNative } from '@perawallet/wallet-core-chain-contract'

// Keeps the query's own native so a press hands it on instead of re-wrapping the view.
export type GroupTransactionRow = {
    native: TransactionNative
    view: AlgorandTransactionView
}

export const toGroupTransactionRows = (
    transactions: TransactionNative[],
): GroupTransactionRow[] =>
    transactions.flatMap(native => {
        const view = readAlgorandNative(native)
        return view ? [{ native, view }] : []
    })
