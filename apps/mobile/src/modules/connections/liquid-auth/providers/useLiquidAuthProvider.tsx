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

import { useCallback, useState } from 'react'
import {
    useLiquidAuthStore,
    type LiquidAuthConnectRequest,
    type LiquidAuthPendingConnection,
} from '@perawallet/wallet-core-liquid-auth'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import {
    useConnectionRequestSheet,
    useConnectionResultSheet,
} from '@modules/connections/hooks'
import { ConnectionView } from '@modules/connections/liquid-auth/components/ConnectionView'
import { ConnectionSuccessSheet } from '@modules/connections/components/ConnectionSuccessSheet'
import { LiquidAuthConnectingContent } from '@modules/connections/liquid-auth/components/LiquidAuthConnectingContent'
import { ConnectionErrorSheet } from '@modules/connections/components/ConnectionErrorSheet'
import { useLiquidAuthConnect } from '@modules/connections/liquid-auth/hooks/useLiquidAuthConnect'

export type UseLiquidAuthProviderResult = {
    connectRequest: Nullable<LiquidAuthConnectRequest>
    pendingConnection: Nullable<LiquidAuthPendingConnection>
    successHost: Nullable<string>
    connectionError: Nullable<Error>
}

/**
 * Effect-driven sheet management for Liquid Auth, anchored on the FIDO ceremony
 * (Liquid Auth binds the address server-side at FIDO time — there is no
 * ARC-0027 `enable` handshake to gate on):
 *
 *   scan → approval sheet (pick account) → on approve: ceremony + transport
 *   (connecting sheet) → success sheet. Errors surface an error sheet.
 *
 * Gated by `isEnabled` (the remote-config flag): the hook is always called to
 * satisfy rules-of-hooks, but every sheet stays closed while disabled.
 */
export const useLiquidAuthProvider = (
    isEnabled: boolean,
): UseLiquidAuthProviderResult => {
    const connectRequest = useLiquidAuthStore(state => state.connectRequest)
    const pendingConnection = useLiquidAuthStore(
        state => state.pendingConnection,
    )
    const connectionError = useLiquidAuthStore(state => state.connectionError)
    const [successHost, setSuccessHost] = useState<Nullable<string>>(null)

    const { connect } = useLiquidAuthConnect()

    const handleApprove = useCallback(
        async (request: LiquidAuthConnectRequest, address: string) => {
            // Dismiss the approval sheet; connect() then drives the connecting
            // status + (on success) session persistence.
            useLiquidAuthStore.getState().setConnectRequest(null)
            try {
                await connect({
                    host: request.host,
                    requestId: request.requestId,
                    address,
                })
                setSuccessHost(request.host)
            } catch (error) {
                logger.error('[liquid-auth] connect failed', { error })
                useLiquidAuthStore.getState().setConnectionError(error as Error)
            }
        },
        [connect],
    )

    const handleReject = useCallback((request: LiquidAuthConnectRequest) => {
        logger.info('[liquid-auth] connect: rejected by user', {
            host: request.host,
        })
        useLiquidAuthStore.getState().setConnectRequest(null)
    }, [])

    const handleCancelConnecting = useCallback(() => {
        useLiquidAuthStore.getState().setPendingConnection(null)
    }, [])

    // Priority: error > approval > connecting > success. successHost gates the
    // earlier sheets so a stale approval/connecting sheet can't reappear after
    // a connect resolves.
    const shouldShowApproval =
        isEnabled && !!connectRequest && !connectionError && !successHost
    const shouldShowConnecting =
        isEnabled &&
        !!pendingConnection &&
        !connectRequest &&
        !connectionError &&
        !successHost

    useConnectionRequestSheet({
        shouldShow: shouldShowApproval,
        // Capture this request: bottom-sheet props are fixed at request time,
        // so the handlers must close over the request shown.
        renderContents: () => {
            const request = connectRequest!
            return (
                <ConnectionView
                    host={request.host}
                    onApprove={address => handleApprove(request, address)}
                    onReject={() => handleReject(request)}
                />
            )
        },
    })

    useConnectionRequestSheet({
        shouldShow: shouldShowConnecting,
        renderContents: () => (
            <LiquidAuthConnectingContent
                pending={pendingConnection!}
                onCancel={handleCancelConnecting}
            />
        ),
        options: {
            size: 'auto',
            enablePanDownToClose: false,
            autoCreateContainer: false,
        },
    })

    useConnectionResultSheet({
        isActive: isEnabled && !!successHost,
        renderContents: () => <ConnectionSuccessSheet name={successHost!} />,
        onClose: () => setSuccessHost(null),
    })

    useConnectionResultSheet({
        isActive: isEnabled && !!connectionError,
        renderContents: () => <ConnectionErrorSheet error={connectionError} />,
        onClose: () => useLiquidAuthStore.getState().setConnectionError(null),
    })

    return {
        connectRequest,
        pendingConnection,
        successHost,
        connectionError,
    }
}
