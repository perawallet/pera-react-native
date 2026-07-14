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

import { useCallback, useRef } from 'react'
import { useSigningEvent } from '@perawallet/wallet-core-signing'

export type UseRekeyProposeHandoffResult = {
    /**
     * Mark that a rekey submit is in flight, so an incoming `'proposed'` event
     * is attributed to it. Call right before awaiting the signing Promise.
     */
    markSubmitted: () => void
    /**
     * True once a multisig propose has been handed off — used to make the
     * eventual (timeout) rejection of the never-resolving signing Promise a
     * no-op instead of surfacing it as an error.
     */
    hasHandedOff: () => boolean
}

/**
 * Shared handoff for rekey confirm flows whose source is a shared (multisig)
 * account. Such a rekey is signed via the multisig propose flow: the signing
 * Promise never resolves (it surfaces as a `'proposed'` signing event), so a
 * confirm screen that just awaits it would leave its CTA spinning until the
 * 5-minute timeout.
 *
 * This mirrors the send-funds pattern: react to the `'proposed'` event, hand
 * off to the global pending-signatures sheet (opened by
 * `useMultisigProposeListener` on the same event), and stop awaiting.
 *
 * `markSubmitted` gates the handler to this screen's own in-flight submit so
 * an unrelated propose elsewhere can't trigger it.
 */
export const useRekeyProposeHandoff = (
    onProposed?: () => void,
): UseRekeyProposeHandoffResult => {
    const submittedRef = useRef(false)
    const handedOffRef = useRef(false)

    useSigningEvent(
        event =>
            event.type === 'transport-result' &&
            event.result.type === 'proposed',
        () => {
            if (!submittedRef.current || handedOffRef.current) return
            handedOffRef.current = true
            onProposed?.()
        },
    )

    return {
        markSubmitted: useCallback(() => {
            submittedRef.current = true
        }, []),
        hasHandedOff: useCallback(() => handedOffRef.current, []),
    }
}
