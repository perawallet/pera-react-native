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
import { useFreezeCardMutation } from '@perawallet/wallet-core-card'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useCardErrorToast } from '../../hooks'

type UseFreezeCardConfirmationSheetResult = {
    /** True while the freeze request is in flight — drives the confirm button. */
    isFreezing: boolean
    onConfirm: () => void
    onClose: () => void
}

/**
 * Owns the freeze request for the confirmation sheet so the pending state lives
 * on the sheet's button. On success it closes the sheet (`resolve`); on failure
 * it surfaces the error and keeps the sheet open so the user can retry.
 */
export const useFreezeCardConfirmationSheet =
    (): UseFreezeCardConfirmationSheetResult => {
        const { resolve, dismiss } = useBottomSheetResult<'confirm'>()
        const freeze = useFreezeCardMutation()
        const showError = useCardErrorToast()

        const confirm = useCallback(async () => {
            // Guard re-entry so a double-tap can't fire a second freeze.
            if (freeze.isPending) return
            try {
                await freeze.mutateAsync()
                resolve('confirm')
            } catch (error) {
                await showError(error)
            }
        }, [freeze, resolve, showError])

        const onConfirm = useCallback(() => {
            void confirm()
        }, [confirm])

        return {
            isFreezing: freeze.isPending,
            onConfirm,
            onClose: dismiss,
        }
    }
