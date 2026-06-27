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

import { useCallback } from 'react'
import { useUnfreezeCardMutation } from '@perawallet/wallet-core-card'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useCardErrorToast } from '../../hooks'

type UseUnfreezeCardConfirmationSheetResult = {
    /** True while the unfreeze request is in flight — drives the confirm button. */
    isUnfreezing: boolean
    onConfirm: () => void
    onClose: () => void
}

/**
 * Owns the unfreeze request for the confirmation sheet so the pending state lives
 * on the sheet's button. On success it closes the sheet (`resolve`); on failure
 * it surfaces the error and keeps the sheet open so the user can retry. Mirrors
 * {@link useFreezeCardConfirmationSheet} so freeze and unfreeze are symmetric.
 */
export const useUnfreezeCardConfirmationSheet =
    (): UseUnfreezeCardConfirmationSheetResult => {
        const { resolve, dismiss } = useBottomSheetResult<'confirm'>()
        const unfreeze = useUnfreezeCardMutation()
        const showError = useCardErrorToast()

        const confirm = useCallback(async () => {
            // Guard re-entry so a double-tap can't fire a second unfreeze.
            if (unfreeze.isPending) return
            try {
                await unfreeze.mutateAsync()
                resolve('confirm')
            } catch (error) {
                await showError(error)
            }
        }, [unfreeze, resolve, showError])

        const onConfirm = useCallback(() => {
            void confirm()
        }, [confirm])

        return {
            isUnfreezing: unfreeze.isPending,
            onConfirm,
            onClose: dismiss,
        }
    }
