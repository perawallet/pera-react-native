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

import { useCallback } from 'react'
import { logger } from '@perawallet/wallet-core-shared'
import {
    abandonPairing,
    waitForSessionOutcome,
    WC_DEEPLINK_SESSION_OUTCOME_TIMEOUT_MS,
    WC_LATE_SESSION_GRACE_MS,
    type WalletConnectPairingOriginSource,
} from '@perawallet/wallet-core-walletconnect'
import { useWalletConnectPairing } from '@modules/walletconnect/hooks/useWalletConnectPairing'
import { usePairingProgressStore } from '@modules/walletconnect/stores/usePairingProgressStore'
import { useReturnToDappStore } from '@modules/walletconnect/stores/useReturnToDappStore'
import { useToast } from '../../useToast'
import { useDeeplinkErrorHandler } from './useDeeplinkErrorHandler'
import type { LinkSource, WalletConnectDeeplink } from '../types'

export type WalletConnectDeeplinkParams = {
    data: WalletConnectDeeplink
    source: LinkSource
    onError?: () => void
    onConnectionError?: () => void
}

/**
 * Resolves `true` once the dApp's session_request arrived (the caller fires
 * its success callback); `false` on any failure, which this handler has
 * already surfaced.
 */
export type WalletConnectDeeplinkHandler = (
    params: WalletConnectDeeplinkParams,
) => Promise<boolean>

/**
 * Owns the WC pairing branch of the deeplink dispatcher: kick off the
 * pairing, keep the user informed while it runs, and translate the outcome
 * into the dispatcher's callbacks.
 *
 * WC v1 bridges were sunset in mid-2024, so most public ones (including the
 * legacy pera bridge older QR codes embed) now 404 without a sync throw —
 * `pair` detects that by waiting for a session_request or error.
 */
export const useWalletConnectDeeplink = (): WalletConnectDeeplinkHandler => {
    const { pair } = useWalletConnectPairing()
    const { hideToast } = useToast()
    const showError = useDeeplinkErrorHandler()

    return useCallback(
        async ({ data, source, onError, onConnectionError }) => {
            const isOsDeeplink = source === 'deeplink'
            // Only 'external-browser' sessions get the return-to-dapp
            // hand-off, and 'in-app' sessions suppress the post-action
            // sheets. Notification-delivered links behave like QR: sheet
            // shown, no hand-off.
            const originSource: WalletConnectPairingOriginSource = isOsDeeplink
                ? 'external-browser'
                : source === 'in-app'
                  ? 'in-app'
                  : 'qr'

            // The OS deep-link path has no other pending UI (QR has the
            // scanner's own overlay), so a global scrim covers the outcome
            // wait; it also gets the extended budget — the app switch pays
            // for a fresh WSS handshake plus the bridge replay.
            if (isOsDeeplink) {
                usePairingProgressStore.getState().beginPairing()
            }
            let result: Awaited<ReturnType<typeof pair>>
            try {
                result = await pair(data.uri, {
                    origin: {
                        source: originSource,
                        browserName: data.browserName,
                    },
                    outcomeTimeoutMs: isOsDeeplink
                        ? WC_DEEPLINK_SESSION_OUTCOME_TIMEOUT_MS
                        : undefined,
                })
            } finally {
                if (isOsDeeplink) {
                    usePairingProgressStore.getState().endPairing()
                }
            }

            if (result.type === 'connect-failed') {
                // The logger's context redaction scrubs the wc URI's
                // symmetric `key=` param.
                logger.error('[deeplink/wc] connect failed', {
                    error: result.error,
                    uri: data.uri,
                })
                showError({
                    variant: 'walletconnect',
                    parsedType: 'WALLET_CONNECT',
                    error: result.error,
                })
                onError?.()
                return false
            }
            if (result.type === 'error') {
                // Handshake rejected (usually wrong network). The provider
                // toasts it above the live camera; keep the scanner open and
                // re-armed instead of firing the misleading timeout error.
                onConnectionError?.()
                return false
            }
            if (result.type === 'timeout') {
                showError({
                    variant: 'walletconnect',
                    parsedType: 'WALLET_CONNECT',
                    error: 'No response from the dApp. The session may be expired or the WalletConnect bridge may be unreachable.',
                })
                onError?.()
                // The timed-out connector's session_request handler stays
                // bound for the full request TTL (5 min) — without this, a
                // straggler dApp response pops a ghost approval sheet long
                // after the error. A late session within the grace hides the
                // stale toast and the sheet opens normally; past it the
                // pairing is abandoned so nothing ever pops.
                if (result.clientId) {
                    const timedOutClientId = result.clientId
                    void waitForSessionOutcome(
                        timedOutClientId,
                        WC_LATE_SESSION_GRACE_MS,
                    ).then(lateOutcome => {
                        if (lateOutcome.type === 'session') {
                            hideToast()
                            return
                        }
                        abandonPairing(timedOutClientId)
                        useReturnToDappStore
                            .getState()
                            .clearReturnContext(timedOutClientId)
                    })
                }
                return false
            }
            return true
        },
        [pair, showError, hideToast],
    )
}
