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

import { useCallback, useMemo } from 'react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    assessRecipient,
    type RecipientAssessment,
} from '@perawallet/wallet-core-transactions'
import { useKnownAddresses } from '../address-safety/useKnownAddresses'
import { useSendFundsStore } from './useSendFunds'

export type UseRecipientSafetyResult = {
    assessment: Optional<RecipientAssessment>
    isPending: boolean
    isAcknowledged: boolean
    toggleAcknowledged: () => void
    isConfirmBlocked: boolean
}

export const useRecipientSafety = ({
    recipient,
    senderAddress,
    scope,
}: {
    recipient: Optional<string>
    /** Only this account's history holds Confirm; the others are best effort. */
    senderAddress: Optional<string>
    scope: ChainScope
}): UseRecipientSafetyResult => {
    const isAcknowledged = useSendFundsStore(
        state => state.isRecipientAcknowledged,
    )
    const setIsRecipientAcknowledged = useSendFundsStore(
        state => state.setIsRecipientAcknowledged,
    )
    const { knownAddresses, isPending, hasSenderHistory } = useKnownAddresses({
        scope,
        senderAddress,
        isEnabled: !!recipient,
    })

    const assessment = useMemo(() => {
        if (!recipient || isPending) return undefined
        const result = assessRecipient({
            recipient,
            chainId: scope.chainId,
            knownAddresses,
        })
        // Without the sender's history a regular payee looks new, and a false
        // "never sent" notice teaches people to ignore it.
        return result.kind === 'first-send' && !hasSenderHistory
            ? undefined
            : result
    }, [recipient, isPending, hasSenderHistory, scope.chainId, knownAddresses])

    const toggleAcknowledged = useCallback(
        () => setIsRecipientAcknowledged(!isAcknowledged),
        [isAcknowledged, setIsRecipientAcknowledged],
    )

    return {
        assessment,
        isPending: !!recipient && isPending,
        isAcknowledged,
        toggleAcknowledged,
        isConfirmBlocked:
            (!!recipient && isPending) ||
            (assessment?.kind === 'look-alike' && !isAcknowledged),
    }
}
