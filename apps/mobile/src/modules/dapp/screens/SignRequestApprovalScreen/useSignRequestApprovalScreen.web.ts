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
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import {
    isSignRequestAwaitingPreflight,
    isSignRequestPastApproval,
    isSignRequestPending,
    useSigningRequest,
    GenesisHashMismatchError,
    type SignRequest,
} from '@perawallet/wallet-core-signing'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { AppError } from '@perawallet/wallet-core-shared'
import {
    enqueueInboundRequest,
    isConnectionAlive,
    useChainTransactionSigning,
    type InboundMessage,
} from '@perawallet/wallet-core-connections'
import {
    declineConnectionRequest,
    decodeWalletOperation,
    encodeWalletOperationResult,
    failConnectionRequest,
    rebuildWireError,
    resolveConnectionRequest,
    submitConnectionRequest,
} from '@perawallet/wallet-core-browser-runtime'
import { useDatabaseReadinessStore } from '@hooks/useDatabaseReadinessStore.web'
import { showConfirmedThenClose } from '@hooks/useApprovalConfirmedStore.web'
import { useLanguage } from '@hooks/useLanguage'
import { useNetworkSwitchPrompt } from '@modules/connections/web'
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
    // A broadcast the host ran comes back with its chain's own copy.
    if (e instanceof AppError && e.metadata.messageKey) {
        return t(e.metadata.messageKey)
    }
    return t('dapp.sign.error.body')
}

export const useSignRequestApprovalScreen =
    (): UseSignRequestApprovalScreenResult => {
        const { requestId, approval, isLoading } = useDappRequest()
        const { t } = useLanguage()
        // The approval's own `chainId` still goes on the message below.
        const transactionSigning = useChainTransactionSigning(LEGACY_CHAIN_ID)
        const { addSignRequest, removeSignRequest, currentRequest } =
            useSigningRequest()
        // The adapter matches a named signer against approved accounts' auth
        // addresses, so it gets every account, keyless ones included.
        const allAccounts = useAllAccounts()
        const confirmNetworkSwitch = useNetworkSwitchPrompt()
        const databaseReadiness = useDatabaseReadinessStore(
            state => state.readiness,
        )
        const enqueuedRef = useRef(false)
        const [error, setError] = useState<string | null>(null)

        useEffect(() => {
            if (enqueuedRef.current) return
            if (!requestId || !approval) return
            if (approval.kind !== 'connection-request') return
            // The accounts store rehydrates asynchronously; on a cold window
            // the resolver would throw against an empty set. Reaching this
            // screen required a granted account, so it hydrates non-empty.
            if (allAccounts.length === 0) return
            // Building a send allocates its nonce from the submission ledger,
            // which the shell opens only after this window has rendered. Other
            // operations skip the wait so the window stays quick for them.
            const needsDatabase = approval.operation.type === 'send-transaction'
            if (needsDatabase && databaseReadiness === 'pending') return
            enqueuedRef.current = true

            if (needsDatabase && databaseReadiness === 'failed') {
                setError(t('dapp.sign.error.body'))
                void failConnectionRequest(requestId)
                return
            }

            // The grant on the message is the snapshot taken when the
            // request arrived; the user can revoke the connection from the
            // popup while this window is open, and signing against a
            // revoked grant would produce a signature nothing can deliver.
            if (!isConnectionAlive(approval.connectionId)) {
                setError(t('dapp.sign.connection_revoked'))
                void failConnectionRequest(requestId)
                return
            }
            // The offscreen host already validated the operation; this rebuilds
            // the neutral adapter's input from the wire.
            const message: InboundMessage = {
                kind: 'request',
                chainId: approval.chainId,
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
                    // Awaited so the pipeline holds the review, and with it
                    // the confirmed control, until the window closes.
                    await showConfirmedThenClose()
                },
                reject: async error => {
                    await declineConnectionRequest(requestId, error)
                    window.close()
                },
            }
            enqueueInboundRequest(message, {
                transactionSigning,
                addSignRequest,
                removeSignRequest,
                isSignRequestPending,
                isSignRequestPastApproval,
                accounts: allAccounts,
                // One request per window, and an expiry withdraws the whole
                // approval at the bridge rather than this one entry.
                pendingRequests: new Map(),
                confirmNetworkSwitch,
                // Keep the window open so the reason is readable.
                onError: err => setError(describeSignError(err, t)),
                // The host broadcasts and answers the dApp, so closing this
                // window mid-send can no longer change what the dApp hears.
                submitSignedSend: async signed => {
                    const outcome = await submitConnectionRequest(
                        requestId,
                        signed,
                    )
                    if (!outcome.ok) {
                        return {
                            status: 'failed',
                            error: rebuildWireError(outcome),
                        }
                    }
                    await showConfirmedThenClose()
                    return { status: 'submitted', txId: outcome.txId }
                },
            })
        }, [
            requestId,
            approval,
            transactionSigning,
            addSignRequest,
            removeSignRequest,
            allAccounts,
            confirmNetworkSwitch,
            databaseReadiness,
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
        // window then rejects the approval via handleWindowRemoved. So does
        // a WalletConnect request still in its chain check, which has no
        // actor to render yet.
        const isAwaitingPreflight =
            !!ownRequest && isSignRequestAwaitingPreflight(ownRequest)
        return {
            isLoading:
                isLoading || (!ownRequest && !error) || isAwaitingPreflight,
            error,
            request: ownRequest,
            origin: approval?.origin ?? '',
            // The dapp was already rejected when `error` was set.
            dismiss: () => window.close(),
        }
    }
