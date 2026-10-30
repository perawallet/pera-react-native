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

import { useMemo } from 'react'
import type {
    AlgorandTransactionView,
    KeyRegType,
} from '@perawallet/wallet-core-chain-algorand/blockchain'
import type { Optional } from '@perawallet/wallet-core-shared'
import { formatParticipationKey, getKeyRegType } from './utils'

export type KeyRegistrationDisplayProps = {
    transaction: AlgorandTransactionView
    isInnerTransaction?: boolean
}

export type UseKeyRegistrationDisplayResult = {
    keyRegType: KeyRegType
    participationKeys: {
        vote: Optional<string>
        selection: Optional<string>
        stateProof: Optional<string>
    }
    showWarnings: boolean
    keyReg: AlgorandTransactionView['keyregTransaction']
}

export const useKeyRegistrationDisplay = ({
    transaction,
}: Pick<
    KeyRegistrationDisplayProps,
    'transaction'
>): UseKeyRegistrationDisplayResult => {
    const keyRegType = useMemo(() => getKeyRegType(transaction), [transaction])
    const participationKeys = useMemo(
        () => ({
            vote: formatParticipationKey(
                transaction.keyregTransaction?.voteParticipationKey,
            ),
            selection: formatParticipationKey(
                transaction.keyregTransaction?.selectionParticipationKey,
            ),
            stateProof: formatParticipationKey(
                transaction.keyregTransaction?.stateProofKey,
            ),
        }),
        [transaction],
    )
    const showWarnings = useMemo(() => !transaction.id, [transaction])

    return {
        keyRegType,
        participationKeys,
        showWarnings,
        keyReg: transaction.keyregTransaction,
    }
}
