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

// Shared ARC-0027 sign-approval wrapper (Task 5 generalizes Task 4's
// transaction-only wrapper): enqueues both `sign-transactions` and
// `sign-message` approvals into the same shared signing pipeline, then lets
// the existing SignRequestView/SigningRoutes pick the right screen off the
// enqueued request's `type` (transactions vs arc60) — no signing UI is
// authored here.
//
// - sign-transactions: unchanged from Task 4 — decodes the ARC-0001 group
//   with the shared resolver and hands it to useEnqueueArc0001SignRequest.
// - sign-message: adapted from
//   apps/mobile/src/modules/webview/hooks/usePeraWebviewInterface.ts
//   (requestDataSigning's ARC-60 branch) — parses the ARC-60 wire payload
//   and calls addSignRequest directly with an Arc60SignRequest. Legacy
//   (non-ARC-60) arbitrary-data signing is out of v1 scope: anything that
//   isn't a valid ARC-60 wire payload is rejected instead of hanging.
//
// Both branches set `transportId: requestId`, so the same
// `currentRequest?.transportId === requestId` gate (below) surfaces only the
// request this screen itself enqueued, regardless of kind.
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
import { type Arc0001WalletTransaction } from '@perawallet/wallet-core-blockchain'
import {
    canSignArc60,
    useSigningAccounts,
} from '@perawallet/wallet-core-accounts'
import {
    encodeToBase64,
    generateOrderedUniqueId,
} from '@perawallet/wallet-core-shared'
import {
    resolveSignTransactions,
    resolveSignMessage,
    rejectApproval,
} from '@perawallet/wallet-extension-platform-chrome'
import { useLanguage } from '@hooks/useLanguage'
import { useDappRequest } from '../../hooks/useDappRequest'

type UseSignRequestApprovalScreenResult = {
    isLoading: boolean
    error: string | null
    request: SignRequest | null
    origin: string
    dismiss: () => void
}

// Turn a pipeline/decode failure into a message the user can act on. The
// signing pipeline delivers a real Error to respondWithError (e.g. a network
// mismatch when the dapp's txns target a different Algorand network than the
// active one); surface a friendly, specific message rather than the raw
// pipeline text or a silent close. Module-level so it's stable across renders
// (no useEffect dependency churn); takes `t` since it has no component scope.
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
        const { addSignRequest, currentRequest } = useSigningRequest()
        const accounts = useSigningAccounts()
        const enqueuedRef = useRef(false)
        const [error, setError] = useState<string | null>(null)

        useEffect(() => {
            if (enqueuedRef.current) return
            if (!requestId || !approval) return
            if (
                approval.kind !== 'sign-transactions' &&
                approval.kind !== 'sign-message'
            ) {
                return
            }
            // The accounts store (zustand `persist` over chrome.storage.local)
            // rehydrates asynchronously. On a cold approval window this
            // effect can otherwise fire before hydration completes, handing
            // the resolver/signer checks below an empty account set — the
            // resolver then throws (no signable txn), which rejects the
            // request and closes the window before any signing UI appears.
            // Stay in the loading state until accounts are present; the
            // `accounts` dependency below re-runs this effect once they
            // hydrate. This can't hang: reaching this screen required an
            // already-granted account for the origin, so accounts hydrate
            // non-empty (a genuinely account-less wallet just stays loading
            // until the user closes the window, which already rejects).
            if (accounts.length === 0) return
            enqueuedRef.current = true

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
                    enqueue(resolved, {
                        sourceType: 'injected',
                        transportId: requestId,
                        verifiedOrigin: approval.origin,
                        sourceMetadata: { url: approval.origin },
                        respondWithResult: async result => {
                            await resolveSignTransactions(requestId, result)
                            window.close()
                        },
                        // User declined inside the signing UI — a plain cancel,
                        // so close without an error screen.
                        respondWithReject: () => {
                            void rejectApproval(requestId).finally(() =>
                                window.close(),
                            )
                        },
                        // The pipeline failed (e.g. the txns target a different
                        // network than the active one). Surface WHY to the user
                        // and give the dapp a terminal response, but keep the
                        // popup open so the message is readable instead of a
                        // silent flash-close.
                        respondWithError: (err: Error) => {
                            setError(describeSignError(err, t))
                            void rejectApproval(requestId)
                        },
                    })
                } catch (e) {
                    // Malformed ARC-0001 group: reject the dapp request with
                    // a terminal error and surface the reason in the popup
                    // instead of hanging on a permanent spinner.
                    setError(describeSignError(e, t))
                    void rejectApproval(requestId)
                }
                return
            }

            // sign-message: legacy (non-ARC-60) arbitrary-data signing is
            // out of v1 scope — reject anything that isn't a valid ARC-60
            // wire payload instead of hanging.
            if (!isArc60WirePayload(approval.message)) {
                setError(t('dapp.sign.unsupported_message'))
                void rejectApproval(requestId)
                return
            }
            try {
                const { stdSigData, metadata } = parseArc60WireRequest(
                    approval.message,
                )

                // Security: only accounts explicitly granted to this origin
                // (approval.approvedAddresses) may be named as the ARC-60
                // signer. Without this, a dapp connected with account A
                // could request a signature naming account B (also held by
                // the wallet but never granted to this origin) — a
                // cross-account/SIWA impersonation escalation. Transaction
                // signing already enforces this via the resolver's
                // authorizedAddresses above; mirrors the same
                // signer-eligibility guard used by
                // usePeraWebviewInterface.requestDataSigning's ARC-60 branch
                // and useWalletConnectHandlers.
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
                // Malformed ARC-60 wire payload: same terminal-error
                // handling as the sign-transactions branch above.
                setError(describeSignError(e, t))
                void rejectApproval(requestId)
            }
        }, [requestId, approval, resolve, enqueue, addSignRequest, accounts, t])

        // The signing store's queue is persist-backed by chrome.storage.local
        // (shared across extension contexts) and rehydrates unresolved
        // interactive requests, so a stale/foreign request (e.g. a pending
        // multisig-cosign from another window) can be at the queue head when
        // this approval window opens. Both enqueue paths above set
        // transportId to requestId, so correlating on it surfaces only the
        // request this screen itself enqueued, regardless of kind.
        const ownRequest =
            currentRequest?.transportId === requestId ? currentRequest : null

        // If a foreign request is at the head, ownRequest stays null and we
        // keep showing the loading state (never someone else's request).
        // Residual case: if our request never reaches the head (stuck behind
        // a foreign one), the window shows loading indefinitely until the
        // user closes it — handleWindowRemoved then fires rejectApproval,
        // giving the dapp a terminal MethodCanceledError rather than a hang.
        return {
            isLoading: isLoading || (!ownRequest && !error),
            error,
            request: ownRequest,
            origin: approval?.origin ?? '',
            // Terminal-close for the error screen's button: the dapp was
            // already rejected when `error` was set, so this only tears down
            // the popup.
            dismiss: () => window.close(),
        }
    }
