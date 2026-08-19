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

import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    getConnectionErrorClientId,
    useWalletConnect,
    useWalletConnectReconnect,
    useWalletConnectSessionRequests,
    useWalletConnectStore,
    type WalletConnectSessionRequest,
} from '@perawallet/wallet-core-walletconnect'
import {
    FEE_ADJUSTMENT_DELIVERY_MESSAGE_MARKER,
    FeeAdjustmentDeliveryError,
} from '@perawallet/wallet-core-signing'
import { useEffect, useRef, useState } from 'react'
import {
    generateUniqueId,
    logger,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useBottomSheet } from '@modules/bottom-sheet'
import { scannerNotifier } from '@components/QRScannerView'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { ConnectionView } from '../components/ConnectionView/ConnectionView'
import { ConnectionSuccessContent } from '../components/ConnectionSuccessContent'
import { useReturnToDappStore } from '../stores/useReturnToDappStore'

/**
 * Consumes the one-shot pairing context once its request settles. Approved
 * sessions keep a persisted `dappOrigin` so later requests on the session
 * (sign completions) know how their sheets should behave.
 */
const consumeReturnContext = (
    clientId: string,
    { wasApproved }: { wasApproved: boolean },
): void => {
    const { returnContexts, clearReturnContext } =
        useReturnToDappStore.getState()
    const context = returnContexts[clientId]
    if (!context) return
    if (wasApproved) {
        useWalletConnectStore.getState().setDappOrigin(clientId, {
            source: context.origin,
            browserName: context.browserName,
        })
    }
    clearReturnContext(clientId)
}

// WalletConnect's `respondWithError` rebuilds a fresh
// `WalletConnectSignRequestError` from only the original error's `.message`
// before it reaches `connectionError` (see
// packages/walletconnect/src/hooks/useWalletConnectHandlers.ts), so a
// `FeeAdjustmentDeliveryError`'s `.name` doesn't survive that hop for the
// WC transaction-signing flow. Match on `.name` for callers that see the
// error directly, and fall back to the message marker every
// `FeeAdjustmentDeliveryError` is constructed with (see
// packages/signing/src/pipeline/errors.ts) for the rewrapped case.
const isFeeAdjustmentDeliveryError = (error: Error): boolean =>
    error.name === FeeAdjustmentDeliveryError.name ||
    error.message.includes(FEE_ADJUSTMENT_DELIVERY_MESSAGE_MARKER)

export const useWalletConnectProvider = () => {
    // Revives dead bridge sockets on foreground return and on network
    // regain — without it, sessions silently drop signed responses and
    // incoming dApp requests until the app restarts.
    useWalletConnectReconnect()

    const { sessionRequests, removeSessionRequest } =
        useWalletConnectSessionRequests()
    const nextRequest = sessionRequests.at(0)
    const [successRequest, setSuccessRequest] =
        useState<Nullable<WalletConnectSessionRequest>>(null)
    const { network } = useNetwork()
    const connectionError = useWalletConnectStore(
        state => state.connectionError,
    )
    const setConnectionError = useWalletConnectStore(
        state => state.setConnectionError,
    )
    const { request: requestBottomSheet, dismiss } = useBottomSheet()
    const { showToast } = useToast()
    const { t } = useLanguage()
    const successOpenRef = useRef(false)
    const connectionSheetIdRef = useRef<Nullable<string>>(null)

    const handleSuccess = (request: WalletConnectSessionRequest) => {
        // In-app pairings (Discover / in-app browser) skip the success
        // sheet: the dApp is right behind it and shows its own connected
        // state. Consume the context now since no sheet-settle will.
        const context =
            useReturnToDappStore.getState().returnContexts[request.clientId]
        if (context?.origin === 'in-app') {
            consumeReturnContext(request.clientId, { wasApproved: true })
            return
        }
        setSuccessRequest(request)
    }

    const handleConnectionError = (error?: Error) => {
        if (error) {
            setConnectionError(error)
        }
        if (nextRequest) {
            removeSessionRequest(nextRequest)
            consumeReturnContext(nextRequest.clientId, { wasApproved: false })
        }
    }

    // The app's single long-lived WalletConnect instance (mounted once from
    // `RootComponent`), so it is the only surface that may own the dApp
    // request handlers a connector's out-of-React listeners call into.
    const { connectSessions } = useWalletConnect(network, {
        ownsRequestHandlers: true,
    })

    useEffect(() => {
        connectSessions()
    }, [connectSessions])

    // Drop dapp origins whose session is gone (disconnected sessions,
    // sessions removed while the app was killed). One sweep per mount is
    // enough — clientIds are never reused across connectors.
    useEffect(() => {
        const { walletConnectConnections, pruneDappOrigins } =
            useWalletConnectStore.getState()
        pruneDappOrigins(
            walletConnectConnections
                .map(connection => connection.clientId)
                .filter((clientId): clientId is string => !!clientId),
        )
    }, [])

    const shouldShowConnection =
        !!nextRequest && !successRequest && !connectionError

    useEffect(() => {
        if (shouldShowConnection && !connectionSheetIdRef.current) {
            const id = generateUniqueId()
            connectionSheetIdRef.current = id
            void requestBottomSheet({
                id,
                contents: (
                    <ConnectionView
                        request={nextRequest!}
                        onSuccess={handleSuccess}
                        onError={handleConnectionError}
                    />
                ),
                options: {
                    size: 'modal',
                    enableCloseOnBackdropPress: false,
                    autoCreateContainer: false,
                },
            })
                // request() rejects loudly when no BottomSheetManager host
                // is mounted — treat that the same as any other connection
                // failure instead of an unhandled rejection.
                .catch((error: unknown) => {
                    handleConnectionError(
                        error instanceof Error
                            ? error
                            : new Error(String(error)),
                    )
                })
                .finally(() => {
                    connectionSheetIdRef.current = null
                })
        } else if (!shouldShowConnection && connectionSheetIdRef.current) {
            const id = connectionSheetIdRef.current
            connectionSheetIdRef.current = null
            dismiss(id)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- sheet open/close only
    }, [shouldShowConnection])

    useEffect(() => {
        if (!successRequest || successOpenRef.current) return
        successOpenRef.current = true
        let cancelled = false
        void (async () => {
            try {
                await requestBottomSheet<void>({
                    contents: (
                        <ConnectionSuccessContent request={successRequest} />
                    ),
                    options: { size: 'auto', enablePanDownToClose: true },
                })
            } catch (error) {
                // request() rejects loudly when no BottomSheetManager host
                // is mounted — fall through to the same cleanup as a normal
                // dismissal instead of an unhandled rejection, but still
                // surface it for observability.
                logger.error('Failed to show WalletConnect success sheet', {
                    error: error instanceof Error ? error : String(error),
                })
            }
            // The sheet settled (Return tap, Close tap, or pan-down) — the
            // one-shot pairing context is consumed either way, and the
            // approved session keeps its persisted origin for the sign flow.
            consumeReturnContext(successRequest.clientId, {
                wasApproved: true,
            })
            if (cancelled) return
            successOpenRef.current = false
            setSuccessRequest(null)
        })()
        return () => {
            cancelled = true
        }
    }, [successRequest, requestBottomSheet])

    // Surface WalletConnect connection errors (wrong network, rejected /
    // expired handshake, …) as a toast rather than a bottom sheet. When the
    // QR scanner is open its native Modal covers the app's root view tree, so
    // the toast is routed to the scanner's own notifier to render on top of
    // the live camera; otherwise it falls back to the global notifier. This
    // matches the native apps, which keep the scanner running and show the
    // error inline instead of blocking it behind a sheet.
    useEffect(() => {
        if (!connectionError) return
        showToast(
            {
                title: t('walletconnect.request.error_sheet_title'),
                body: isFeeAdjustmentDeliveryError(connectionError)
                    ? t('walletconnect.request.quantum_fee_delivery_failed')
                    : connectionError.message,
                type: 'error',
            },
            { notifier: scannerNotifier.current ?? undefined },
        )
        // Only drop the pending request belonging to the connector that
        // errored — not whatever happens to be first in the queue — so an
        // error from one dApp can't discard another dApp's still-valid
        // pending approval.
        const erroredClientId = getConnectionErrorClientId(connectionError)
        const erroredRequest = erroredClientId
            ? sessionRequests.find(r => r.clientId === erroredClientId)
            : undefined
        if (erroredRequest) {
            removeSessionRequest(erroredRequest)
            consumeReturnContext(erroredRequest.clientId, {
                wasApproved: false,
            })
        }
        setConnectionError(null)
    }, [
        connectionError,
        showToast,
        t,
        sessionRequests,
        removeSessionRequest,
        setConnectionError,
    ])

    return {
        nextRequest,
        successRequest,
        connectionError,
        handleConnectionError,
        handleSuccess,
    }
}
