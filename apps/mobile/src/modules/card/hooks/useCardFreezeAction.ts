/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    CardStatus,
    useCardStatusQuery,
    useFreezeCardMutation,
} from '@perawallet/wallet-core-card'
import { useCardConfirmMutation } from './useCardConfirmMutation'

/**
 * What the freeze confirm sheet resolved with: `frozen` when this action issued
 * the freeze, `skipped` when the card wasn't freezable (already frozen, or
 * blocked) so no request was sent. A dismiss resolves the request with
 * `undefined`. Callers use this to tell "we froze the card" from "nothing
 * happened" — e.g. the report-suspicious flow only toasts on `frozen`.
 */
export type CardFreezeOutcome = 'frozen' | 'skipped'

type UseCardFreezeActionOptions = {
    /** Runs once the freeze settles (whether it ran or was skipped), before the
     * sheet resolves — e.g. to open a support email. */
    onFrozen?: () => void
}

type UseCardFreezeActionResult = {
    /** True while the freeze request is in flight — drives the confirm button. */
    isFreezing: boolean
    onConfirm: () => void
    onClose: () => void
}

/**
 * Shared confirm action for the card's freeze-then-act sheets (freeze,
 * report-suspicious, report-lost/stolen). Only a live (ACTIVE) card is frozen;
 * an already-frozen or BLOCKED card skips the request but still runs the side
 * effect and resolves. A freeze failure surfaces the error and keeps the sheet
 * open for a retry.
 */
export const useCardFreezeAction = (
    options?: UseCardFreezeActionOptions,
): UseCardFreezeActionResult => {
    const { data: card } = useCardStatusQuery()
    const freeze = useFreezeCardMutation()
    const canFreeze = card?.status === CardStatus.Active

    const { isPending, onConfirm, onClose } =
        useCardConfirmMutation<CardFreezeOutcome>({
            mutation: freeze,
            shouldMutate: canFreeze,
            onMutated: options?.onFrozen,
            resolveOnMutate: 'frozen',
            resolveOnSkip: 'skipped',
        })

    return { isFreezing: isPending, onConfirm, onClose }
}
