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

// Legacy (non-ARC-60) arbitrary-data signing over the injected transport is
// rejected rather than left hanging.
import { useEffect, useRef, useState } from 'react'
import {
    useArc0001Resolver,
    useEnqueueArc0001SignRequest,
    useSigningRequest,
    isArc60WirePayload,
    parseArc60WireRequest,
    GenesisHashMismatchError,
    type SignRequest,
    type Arc60SignRequest,
    type PeraArbitraryDataSignResult,
} from '@perawallet/wallet-core-signing'
import type { Arc0001WalletTransaction } from '@perawallet/wallet-core-blockchain'
import {
    canSignArc60,
    useAllAccounts,
    useSigningAccounts,
} from '@perawallet/wallet-core-accounts'
import {
    enqueueInboundRequest,
    type InboundMessage,
} from '@perawallet/wallet-core-connections'
import {
    encodeToBase64,
    generateOrderedUniqueId,
} from '@perawallet/wallet-core-shared'
import {
    decodeWalletOperation,
    encodeWalletOperationResult,
    rejectApproval,
    resolveConnectionRequest,
    resolveSignMessage,
    resolveSignTransactions,
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
            if (
                approval.kind !== 'sign-transactions' &&
                approval.kind !== 'sign-message' &&
                approval.kind !== 'connection-request'
            ) {
                return
            }
            // The accounts store rehydrates asynchronously; on a cold window
            // the resolver would throw against an empty set. Reaching this
            // screen required a granted account, so it hydrates non-empty.
            if (accounts.length === 0) return
            enqueuedRef.current = true

            if (approval.kind === 'connection-request') {
                // The offscreen host already validated the operation; this rebuilds
                // the neutral adapter's input from the wire.
                const message: InboundMessage = {
                    kind: 'request',
                    connectionId: approval.connectionId,
                    correlationId: approval.correlationId,
                    authorizedAccounts: approval.authorizedAccounts,
                    peer: approval.peer,
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
                })
                return
            }

            if (approval.kind === 'sign-transactions') {
                try {
                    const txns = approval.txns as Arc0001WalletTransaction[]
                    const resolved = resolve(
                        { transactions: txns },
                        {
                            authorizedAddresses: new Set(
                                approval.approvedAddresses,
                            ),
                        },
                    )
                    // enqueue handles its own failures via respondWithError.
                    void enqueue(resolved, {
                        sourceType: 'injected',
                        transportId: requestId,
                        verifiedOrigin: approval.origin,
                        sourceMetadata: { url: approval.origin },
                        respondWithResult: async result => {
                            await resolveSignTransactions(requestId, result)
                            window.close()
                        },
                        respondWithReject: () => {
                            void rejectApproval(requestId).finally(() =>
                                window.close(),
                            )
                        },
                        // Keep the popup open so the reason is readable.
                        respondWithError: (err: Error) => {
                            setError(describeSignError(err, t))
                            void rejectApproval(requestId)
                        },
                    })
                } catch (e) {
                    setError(describeSignError(e, t))
                    void rejectApproval(requestId)
                }
                return
            }

            if (!isArc60WirePayload(approval.message)) {
                setError(t('dapp.sign.unsupported_message'))
                void rejectApproval(requestId)
                return
            }
            try {
                const { stdSigData, metadata } = parseArc60WireRequest(
                    approval.message,
                )

                // Only accounts granted to THIS origin may be named as the
                // signer; otherwise a dapp connected with account A could
                // request a SIWA signature naming account B.
                const signerAccount = accounts.find(
                    account => account.address === stdSigData.signer,
                )
                if (
                    !approval.approvedAddresses.includes(stdSigData.signer) ||
                    !signerAccount ||
                    !canSignArc60(signerAccount)
                ) {
                    setError(t('dapp.sign.unauthorized_signer'))
                    void rejectApproval(requestId)
                    return
                }

                addSignRequest({
                    id: generateOrderedUniqueId(),
                    type: 'arc60',
                    transport: 'callback',
                    sourceType: 'injected',
                    transportId: requestId,
                    verifiedOrigin: approval.origin,
                    sourceMetadata: { url: approval.origin },
                    stdSigData,
                    metadata,
                    approve: async (signed: PeraArbitraryDataSignResult[]) => {
                        await resolveSignMessage(
                            requestId,
                            encodeToBase64(signed[0].signature),
                        )
                        window.close()
                    },
                    reject: async () => {
                        await rejectApproval(requestId)
                        window.close()
                    },
                    error: async () => {
                        await rejectApproval(requestId)
                        window.close()
                    },
                } as Arc60SignRequest)
            } catch (e) {
                setError(describeSignError(e, t))
                void rejectApproval(requestId)
            }
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
