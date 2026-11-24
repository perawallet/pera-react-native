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
import { useLanguage } from '@hooks/useLanguage'
import { humaniseFunctionName } from '../utils/humaniseFunctionName'
import { CONTRACT_CALL_TITLE_KEY } from '../utils/recordTitleKeys'
import type { EthereumTransactionPresentation } from './useEthereumTransactionPresentation'
import { useEthereumVerifiedCall } from './useEthereumVerifiedCall'

// History lists a call by what it was; the review asks the user to do it.
const REVIEW_TITLE_KEYS: Partial<Record<string, string>> = {
    'transactions.list_item.approval': 'signing.review.title_approve',
    [CONTRACT_CALL_TITLE_KEY]: 'signing.review.title_contract_interaction',
}

/** The action's verb, or a verified call's function name. */
export const useEthereumReviewTitle = (
    presentation: Pick<
        EthereumTransactionPresentation,
        | 'view'
        | 'scope'
        | 'titleKey'
        | 'standardCall'
        | 'contractAction'
        | 'isTransfer'
    >,
): string => {
    const { t } = useLanguage()
    const { view, scope, titleKey, standardCall, contractAction, isTransfer } =
        presentation
    const verifiedCall = useEthereumVerifiedCall(view, scope, true)

    return useMemo(() => {
        if (
            verifiedCall.status === 'decoded' &&
            !standardCall &&
            !contractAction &&
            !isTransfer
        ) {
            return humaniseFunctionName(verifiedCall.call.functionName)
        }
        return t(REVIEW_TITLE_KEYS[titleKey] ?? titleKey)
    }, [titleKey, verifiedCall, standardCall, contractAction, isTransfer, t])
}
