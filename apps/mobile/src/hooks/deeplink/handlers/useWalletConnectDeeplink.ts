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
import { CONNECTION_DEEPLINK_OUTCOME_TIMEOUT_MS } from '@perawallet/wallet-core-connections'
import { logger } from '@perawallet/wallet-core-shared'
import type { ConnectionOriginSource } from '@perawallet/wallet-extension-connections'
import { useConnectionPairing } from '@modules/connections/hooks/useConnectionPairing'
import { usePairingProgressStore } from '@modules/walletconnect/stores/usePairingProgressStore'
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
 * Owns the pairing branch of the deeplink dispatcher: hand the URI to the
 * connection registry, keep the user informed while it runs, and translate
 * the outcome into the dispatcher's callbacks. The registry decides which
 * protocol owns the URI and redacts it for the logs. Two WalletConnect-named
 * residues stay: the pairing progress store and the analytics variant names,
 * both of them user- and dashboard-facing vocabulary rather than a protocol
 * decision, and both renameable without touching this sequence.
 */
export const useWalletConnectDeeplink = (): WalletConnectDeeplinkHandler => {
    const { pair, describeUri } = useConnectionPairing()
    const { hideToast } = useToast()
    const showError = useDeeplinkErrorHandler()

    return useCallback(
        async ({ data, source, onError, onConnectionError }) => {
            const isOsDeeplink = source === 'deeplink'
            // Only 'external-browser' sessions get the return-to-dapp
            // hand-off, and 'in-app' sessions suppress the post-action
            // sheets. Notification-delivered links behave like QR: sheet
            // shown, no hand-off.
            const originSource: ConnectionOriginSource = isOsDeeplink
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
                        ? CONNECTION_DEEPLINK_OUTCOME_TIMEOUT_MS
                        : undefined,
                })
            } finally {
                if (isOsDeeplink) {
                    usePairingProgressStore.getState().endPairing()
                }
            }

            if (result.type === 'connect-failed') {
                // Never log the URI itself: its `key=` param is the pairing
                // secret.
                logger.error('[deeplink/wc] connect failed', {
                    error: result.error,
                    ...describeUri(data.uri),
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
                    variant: 'walletconnect_timeout',
                    parsedType: 'WALLET_CONNECT',
                })
                onError?.()
                // A late answer within the grace still opens the sheet, so
                // the stale toast has to go.
                void result.lateOutcome?.then(lateOutcome => {
                    if (lateOutcome.type === 'proposal') hideToast()
                })
                return false
            }
            return true
        },
        [pair, describeUri, showError, hideToast],
    )
}
