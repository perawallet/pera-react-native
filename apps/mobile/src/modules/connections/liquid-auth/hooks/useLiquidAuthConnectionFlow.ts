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

import { useCallback, useEffect, useRef, useState } from 'react'
import {
    useLiquidAuthStore,
    type DisplayIdentity,
    type LiquidAuthConnectRequest,
    LiquidAuthRejectedError,
} from '@perawallet/wallet-core-liquid-auth'
import { useLiquidAuthConnect } from './useLiquidAuthConnect'

export type LiquidAuthFlowPhase =
    | 'select-account'
    | 'connecting'
    | 'confirm'
    | 'finalizing'

export type UseLiquidAuthConnectionFlowResult = {
    phase: LiquidAuthFlowPhase
    request: LiquidAuthConnectRequest
    selectedAddress: string | null
    identity: DisplayIdentity | null
    onSelectAccount: (address: string) => void
    onConfirm: () => void
    onReject: () => void
    onCancel: () => void
}

/**
 * Owns the Liquid Auth connection sheet's phase machine for one scanned
 * request: select-account → connecting → confirm. `connect` runs the
 * ceremony/channel/negotiation and calls back through `requestConfirmation`
 * once the dApp identity is known; this hook surfaces that identity and holds
 * the promise until the user taps Connect or Reject. Terminal success/error
 * clear the request / set the connection error in the store.
 */
export const useLiquidAuthConnectionFlow = (
    request: LiquidAuthConnectRequest,
    /** Called with the connected dApp's display name once the user confirms and
     *  the session is persisted — drives the success sheet. */
    onConnected?: (name: string) => void,
): UseLiquidAuthConnectionFlowResult => {
    const { connect } = useLiquidAuthConnect()
    const [phase, setPhase] = useState<LiquidAuthFlowPhase>('select-account')
    const [selectedAddress, setSelectedAddress] = useState<string | null>(null)
    const [identity, setIdentity] = useState<DisplayIdentity | null>(null)
    const confirmResolver = useRef<((approved: boolean) => void) | null>(null)
    // Latest resolved identity, readable in the connect().then closure (state
    // would be stale there).
    const identityRef = useRef<DisplayIdentity | null>(null)
    // Set when the user cancels during `connecting` (before the identity/confirm
    // step): a later requestConfirmation then resolves false immediately so the
    // in-flight connect tears the channel down instead of dangling.
    const cancelledRef = useRef(false)
    // Set once the user confirms: the connect is now persisting the session, so
    // Cancel/Reject must be inert — otherwise a late tap would clear the request
    // (dismissing the sheet) while the connection still succeeds and pops the
    // success sheet.
    const finalizingRef = useRef(false)

    const clearRequest = () =>
        useLiquidAuthStore.getState().setConnectRequest(null)

    useEffect(() => {
        setPhase('select-account')
        setSelectedAddress(null)
        setIdentity(null)
        confirmResolver.current = null
        identityRef.current = null
        cancelledRef.current = false
        finalizingRef.current = false
    }, [request.requestId])

    const onSelectAccount = useCallback(
        (address: string) => {
            setSelectedAddress(address)
            setPhase('connecting')
            connect({
                host: request.host,
                requestId: request.requestId,
                address,
                requestConfirmation: id =>
                    new Promise<boolean>(resolve => {
                        if (cancelledRef.current) {
                            resolve(false)
                            return
                        }
                        identityRef.current = id
                        setIdentity(id)
                        setPhase('confirm')
                        confirmResolver.current = resolve
                    }),
            })
                .then(() => {
                    clearRequest()
                    onConnected?.(identityRef.current?.name ?? request.host)
                })
                .catch(error => {
                    clearRequest()
                    if (!(error instanceof LiquidAuthRejectedError)) {
                        useLiquidAuthStore
                            .getState()
                            .setConnectionError(error as Error)
                    }
                })
        },
        [connect, onConnected, request.host, request.requestId],
    )

    const onConfirm = useCallback(() => {
        // Enter finalizing so the buttons go inert while connect persists the
        // session; the flow settles into success (onConnected) or error shortly.
        finalizingRef.current = true
        setPhase('finalizing')
        confirmResolver.current?.(true)
        confirmResolver.current = null
    }, [])

    const onReject = useCallback(() => {
        if (finalizingRef.current) return
        // Confirm phase: resolve false (connect rejects → its catch clears the
        // request). Select-account phase: no resolver yet, so clear directly.
        confirmResolver.current?.(false)
        confirmResolver.current = null
        clearRequest()
    }, [])

    const onCancel = useCallback(() => {
        if (finalizingRef.current) return
        cancelledRef.current = true
        confirmResolver.current?.(false)
        confirmResolver.current = null
        clearRequest()
    }, [])

    return {
        phase,
        request,
        selectedAddress,
        identity,
        onSelectAccount,
        onConfirm,
        onReject,
        onCancel,
    }
}
