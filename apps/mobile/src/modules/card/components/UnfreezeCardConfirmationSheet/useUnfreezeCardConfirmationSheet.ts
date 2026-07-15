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

import { useUnfreezeCardMutation } from '@perawallet/wallet-core-card'
import { useCardConfirmMutation } from '../../hooks'

type UseUnfreezeCardConfirmationSheetResult = {
    /** True while the unfreeze request is in flight — drives the confirm button. */
    isUnfreezing: boolean
    onConfirm: () => void
    onClose: () => void
}

/**
 * Owns the unfreeze request for the confirmation sheet so the pending state
 * lives on the sheet's button. Builds on {@link useCardConfirmMutation}: on
 * success it closes the sheet, on failure it surfaces the error and keeps the
 * sheet open for a retry.
 */
export const useUnfreezeCardConfirmationSheet =
    (): UseUnfreezeCardConfirmationSheetResult => {
        const unfreeze = useUnfreezeCardMutation()

        const { isPending, onConfirm, onClose } =
            useCardConfirmMutation<'confirm'>({
                mutation: unfreeze,
                resolveOnMutate: 'confirm',
            })

        return { isUnfreezing: isPending, onConfirm, onClose }
    }
