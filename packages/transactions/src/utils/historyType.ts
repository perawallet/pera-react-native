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

import type { TransactionSummary } from '@perawallet/wallet-core-chain-contract'

export type TransactionHistoryType =
    | 'swaps'
    | 'approvals'
    | 'defi'
    | 'transfers'
    | 'other'

/**
 * The History filter bucket a row falls in, read from the same summary that
 * names the row. A contract call counts as DeFi only when its title names a
 * protocol action; one guessed as a send or receive from what it moved stays
 * with transfers, and one nothing named is Other.
 */
export const historyTypeOf = (
    summary: TransactionSummary,
): TransactionHistoryType => {
    switch (summary.kind) {
        case 'swap': {
            return 'swaps'
        }
        case 'approval': {
            return 'approvals'
        }
        case 'transfer':
        case 'token-transfer':
        case 'nft-transfer': {
            return 'transfers'
        }
        case 'contract-call': {
            if (summary.isProtocolAction) return 'defi'
            return summary.isActionUnknown ? 'other' : 'transfers'
        }
        case 'chain-specific': {
            return 'other'
        }
    }
}
