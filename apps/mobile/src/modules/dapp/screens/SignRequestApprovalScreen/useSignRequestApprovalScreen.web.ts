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

import { useEffect, useRef, useState } from 'react'
import {
    useArc0001Resolver,
    useEnqueueArc0001SignRequest,
    useSigningRequest,
    GenesisHashMismatchError,
    type SignRequest,
} from '@perawallet/wallet-core-signing'
import {
    useAllAccounts,
    useSigningAccounts,
} from '@perawallet/wallet-core-accounts'
import {
    enqueueInboundRequest,
    isConnectionAlive,
    type InboundMessage,
} from '@perawallet/wallet-core-connections'
import {
    decodeWalletOperation,
    encodeWalletOperationResult,
    rejectApproval,
    resolveConnectionRequest,
} from '@perawallet/wallet-extension-platform-chrome'
import { useLanguage } from '@hooks/useLanguage'
import { useDappRequest } from '../../hooks/useDappRequest.web'

type UseSignRequestApprovalScreenResult = {
    isLoading: boolean
    error: string | null
    request: SignRequest | null
    origin: string
    dismiss: () => void
}

// The pipeline delivers a real Error (e.g. a network mismatch); surface a
// specific message rather than the raw pipeline text or a silent close.
const describeSignError = (e: unknown, t: (key: string) => string): string => {
    if (e instanceof GenesisHashMismatchError) {
        return t('dapp.sign.network_mismatch')
    }
    return t('dapp.sign.error.body')
}

export const useSignRequestApprovalScreen =
    (): UseSignRequestApprovalScreenResult => {
        const { requestId, approval, isLoading } = useDappRequest()
        const { t } = useLanguage()
        const resolve = useArc0001Resolver()
        const enqueue = useEnqueueArc0001SignRequest()
        const { addSignRequest, removeSignRequest, currentRequest } =
            useSigningRequest()
        const accounts = useSigningAccounts()
        // The adapter matches a named signer against approved accounts' auth
        // addresses, and useSigningAccounts filters a keyless one of those out.
        const allAccounts = useAllAccounts()
        const enqueuedRef = useRef(false)
        const [error, setError] = useState<string | null>(null)

        useEffect(() => {
            if (enqueuedRef.current) return
            if (!requestId || !approval) return
            if (approval.kind !== 'connection-request') return
            // The accounts store rehydrates asynchronously; on a cold window
            // the resolver would throw against an empty set. Reaching this
            // screen required a granted account, so it hydrates non-empty.
            if (accounts.length === 0) return
            enqueuedRef.current = true

            // The grant on the message is the snapshot taken when the
            // request arrived; the user can revoke the connection from the
            // popup while this window is open, and signing against a
            // revoked grant would produce a signature nothing can deliver.
            if (!isConnectionAlive(approval.connectionId)) {
                setError(t('dapp.sign.connection_revoked'))
                void rejectApproval(requestId)
                return
            }
            // The offscreen host already validated the operation; this rebuilds
            // the neutral adapter's input from the wire.
            const message: InboundMessage = {
                kind: 'request',
                sourceType: approval.sourceType,
                connectionId: approval.connectionId,
                correlationId: approval.correlationId,
                authorizedAccounts: approval.authorizedAccounts,
                peer: approval.peer,
                verifiedOrigin: approval.verifiedOrigin,
                operation: decodeWalletOperation(approval.operation),
                respond: async result => {
                    await resolveConnectionRequest(
                        requestId,
                        encodeWalletOperationResult(result),
                    )
                    window.close()
                },
                reject: async () => {
                    await rejectApproval(requestId)
                    window.close()
                },
            }
            enqueueInboundRequest(message, {
                resolveArc0001: resolve,
                enqueueArc0001: enqueue,
                addSignRequest,
                removeSignRequest,
                accounts: allAccounts,
                // One request per window, and an expiry withdraws the whole
                // approval at the bridge rather than this one entry.
                pendingRequests: new Map(),
                // Keep the window open so the reason is readable.
                onError: err => setError(describeSignError(err, t)),
            })
        }, [
            requestId,
            approval,
            resolve,
            enqueue,
            addSignRequest,
            removeSignRequest,
            accounts,
            allAccounts,
            t,
        ])

        // The persist-backed queue can hold a foreign request (a pending multisig
        // cosign from another window) at its head, so only the request this screen
        // enqueued is surfaced. A connection request is keyed on its connectionId.
        const correlationId =
            approval?.kind === 'connection-request'
                ? approval.connectionId
                : requestId
        const ownRequest =
            currentRequest?.transportId === correlationId
                ? currentRequest
                : null

        // A foreign request at the head keeps this loading; closing the
        // window then rejects the approval via handleWindowRemoved.
        return {
            isLoading: isLoading || (!ownRequest && !error),
            error,
            request: ownRequest,
            origin: approval?.origin ?? '',
            // The dapp was already rejected when `error` was set.
            dismiss: () => window.close(),
        }
    }
