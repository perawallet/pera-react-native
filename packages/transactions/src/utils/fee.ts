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

import { isSameAddress } from '@perawallet/wallet-core-accounts'
import type { TransactionRecord } from '@perawallet/wallet-core-chain-contract'

/**
 * Whether `address` paid the record's network fee. The wallet's own sends name no initiator,
 * and a ledger `failed` may be a node rejection or an on-chain revert; its fee shows once
 * History lists the row with its signer.
 */
export const isFeePaidByAccount = (
    record: TransactionRecord,
    address: string,
): boolean => {
    if (record.fee === undefined || !address || record.status === 'replaced') {
        return false
    }
    if (record.initiator === undefined) return record.status !== 'failed'
    return isSameAddress(record.scope.chainId, record.initiator, address)
}
