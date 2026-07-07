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
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useCardErrorToast } from './useCardErrorToast'

type ConfirmMutation = {
    isPending: boolean
    mutateAsync: () => Promise<unknown>
}

type UseCardConfirmMutationOptions<TResolved> = {
    /** The mutation the confirm button runs. */
    mutation: ConfirmMutation
    /** When false the mutation is skipped but the sheet still resolves — e.g.
     * the card is already in the target state. Defaults to always running. */
    shouldMutate?: boolean
    /** Runs after the mutation settles (whether it ran or was skipped) and
     * before the sheet resolves — e.g. to open a support email. */
    onMutated?: () => void
    /** Resolved value when the mutation actually ran. */
    resolveOnMutate: TResolved
    /** Resolved value when the mutation was skipped; defaults to `resolveOnMutate`. */
    resolveOnSkip?: TResolved
}

type UseCardConfirmMutationResult = {
    /** True while the mutation is in flight — drives the confirm button. */
    isPending: boolean
    onConfirm: () => void
    onClose: () => void
}

/**
 * Shared confirm handler for the card's mutation-backed confirmation sheets
 * (freeze, unfreeze, report-lost/stolen). Guards re-entry, runs the mutation
 * (optionally skipped when the card is already in the target state), fires an
 * optional side effect, then resolves the sheet with an outcome the caller can
 * branch on. A failure surfaces the error and keeps the sheet open for a retry.
 */
export const useCardConfirmMutation = <TResolved>({
    mutation,
    shouldMutate = true,
    onMutated,
    resolveOnMutate,
    resolveOnSkip,
}: UseCardConfirmMutationOptions<TResolved>): UseCardConfirmMutationResult => {
    const { resolve, dismiss } = useBottomSheetResult<TResolved>()
    const showError = useCardErrorToast()
    const { isPending, mutateAsync } = mutation

    const confirm = useCallback(async () => {
        // Guard re-entry so a double-tap can't fire a second request.
        if (isPending) return
        if (shouldMutate) {
            try {
                await mutateAsync()
            } catch (error) {
                await showError(error)
                return
            }
        }
        onMutated?.()
        resolve(
            shouldMutate ? resolveOnMutate : (resolveOnSkip ?? resolveOnMutate),
        )
    }, [
        isPending,
        shouldMutate,
        mutateAsync,
        onMutated,
        resolve,
        resolveOnMutate,
        resolveOnSkip,
        showError,
    ])

    const onConfirm = useCallback(() => {
        void confirm()
    }, [confirm])

    return { isPending, onConfirm, onClose: dismiss }
}
