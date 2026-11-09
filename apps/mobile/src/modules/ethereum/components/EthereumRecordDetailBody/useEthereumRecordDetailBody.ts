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

import type { TransactionRecord } from '@perawallet/wallet-core-chain-contract'
import {
    useEthereumRecordDetail,
    type UseEthereumRecordDetailResult,
} from '../../hooks/useEthereumRecordDetail'

export type UseEthereumRecordDetailBodyResult =
    UseEthereumRecordDetailResult & {
        /** The history named no action for the call, and no read explained it. */
        isUndecodedCall: boolean
        /** The title was guessed from the balance changes, and no read replaced it. */
        isInferredTitle: boolean
    }

export const useEthereumRecordDetailBody = (
    record: TransactionRecord,
): UseEthereumRecordDetailBodyResult => {
    const detail = useEthereumRecordDetail(record)
    const { transaction, isLoading, isReadFailed } = detail
    const { summary } = record
    const isSettledUnread = !transaction && !isLoading

    return {
        ...detail,
        // A call the history could name (supply, swap) is understood; only the fallbacks warrant the warning.
        isUndecodedCall:
            isSettledUnread &&
            !isReadFailed &&
            summary.kind === 'contract-call' &&
            !!summary.isActionUnknown,
        isInferredTitle: isSettledUnread && !!summary.isInferred,
    }
}
