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

// Enqueues `sign-transactions`, `sign-message`, and headless-WalletConnect
// `wc-sign` approvals into the shared signing pipeline and lets
// SignRequestView pick the screen off the request's `type` — no signing UI is
// authored here.
//
// Legacy (non-ARC-60) arbitrary-data signing is out of scope: an invalid
// ARC-60 wire payload is rejected rather than left hanging.
//
// wc-sign exists because the offscreen document owns the WC v1 socket but has
// no vault: a gate-surviving request is forwarded here to run through the same
// pipeline, with only the respond callbacks differing (resolveWcSign /
// rejectApproval rather than a locally-held connector).
//
// sign-transactions/sign-message set `transportId: requestId`; wc-sign sets
// `transportId: approval.clientId`, since a WC session rather than this
// approval window is the correlation unit. See `ownRequest` below.
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
    encodeToBase64,
    generateOrderedUniqueId,
    logger,
} from '@perawallet/wallet-core-shared'
import {
    useWalletConnectStore,
    WalletConnectInvalidSessionError,
} from '@perawallet/wallet-core-walletconnect'
import {
    resolveSignTransactions,
    resolveSignMessage,
    resolveWcSign,
    rejectApproval,
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
    if (e instanceof WalletConnectInvalidSessionError) {
        return t('dapp.sign.no_session')
    }
    return t('dapp.sign.error.body')
}

// Every inbound WC v1 algo_signTxn request is `{ id, params: [[...]] }`; the
// gate in packages/walletconnect/src/validation/inboundRequestGate.ts already
// confirmed params[0] is a non-empty array of txn-string entries before this
// request ever reached an approval surface.
const readWalletTransactions = (
    payload: unknown,
): Arc0001WalletTransaction[] | undefined => {
    const params = (payload as { params?: unknown[] } | null)?.params
    const group = Array.isArray(params) ? params[0] : undefined
    return Array.isArray(group)
        ? (group as Arc0001WalletTransaction[])
        : undefined
}

// algo_signData's WC envelope is `{ id, params: <arc60-wire-object> }` — a
// single object, unlike algo_signTxn's array-of-arrays. Same wire shape
// isArc60WirePayload/parseArc60WireRequest already validate for the
// injected/webview sign-message transport (packages/walletconnect/src/
// schema.ts's arc60PayloadSchema IS packages/signing's arc60WireSchema —
// one shared wire format for every transport).
const readArc60Params = (payload: unknown): unknown =>
    (payload as { params?: unknown } | null)?.params

export const useSignRequestApprovalScreen =
    (): UseSignRequestApprovalScreenResult => {
        const { requestId, approval, isLoading } = useDappRequest()
        const { t } = useLanguage()
        const resolve = useArc0001Resolver()
        const enqueue = useEnqueueArc0001SignRequest()
        const { addSignRequest, currentRequest } = useSigningRequest()
        const accounts = useSigningAccounts()
        // canSignArc60 resolves a keyless rekeyed signer through its auth
        // account, so it needs the UNFILTERED list: useSigningAccounts drops
        // any account that can't sign for itself, which can hide the very
        // auth account holding the key.
        const allAccounts = useAllAccounts()
        const connections = useWalletConnectStore(
            state => state.walletConnectConnections,
        )
        const enqueuedRef = useRef(false)
        const [error, setError] = useState<string | null>(null)

        // useWalletConnectStore is a SEPARATE zustand `persist` store from
        // the accounts store below, rehydrating independently over the same
        // async chrome.storage.local adapter. Only `wc-sign` approvals read
        // it, but which store wins the hydration race is bundler-init
        // dependent — gate explicitly rather than let an empty
        // `walletConnectConnections: []` silently look like "no session".
        const [isWcStoreHydrated, setIsWcStoreHydrated] = useState(() =>
            useWalletConnectStore.persist.hasHydrated(),
        )
        useEffect(() => {
            if (isWcStoreHydrated) return
            // Re-check rather than trusting the `isWcStoreHydrated` this
            // effect closed over: hydration (chrome.storage.local resolving)
            // and this effect's subscription both land on separate
            // macrotasks, so hydration can finish in the gap between the
            // render that read `hasHydrated() === false` and this effect
            // subscribing. zustand's persist fires onFinishHydration
            // listeners exactly once with no replay for late subscribers —
            // miss that window and the callback below never fires, and
            // since `isWcStoreHydrated` is this effect's only dep, nothing
            // ever re-runs it. Without this re-check the popup spins forever
            // on exactly that race.
            if (useWalletConnectStore.persist.hasHydrated()) {
                setIsWcStoreHydrated(true)
                return
            }
            return useWalletConnectStore.persist.onFinishHydration(() => {
                setIsWcStoreHydrated(true)
            })
        }, [isWcStoreHydrated])

        useEffect(() => {
            if (enqueuedRef.current) return
            if (!requestId || !approval) return
            if (
                approval.kind !== 'sign-transactions' &&
                approval.kind !== 'sign-message' &&
                approval.kind !== 'wc-sign'
            ) {
                return
            }
            // The accounts store rehydrates asynchronously, so on a cold
            // approval window this effect can fire against an empty set — the
            // resolver then throws and closes the window before any signing UI
            // appears. Can't hang: reaching this screen required an already
            // granted account, so accounts hydrate non-empty.
            if (accounts.length === 0) return
            // wc-sign additionally needs the WC store hydrated before the
            // session lookup below can tell "not hydrated yet" apart from
            // "genuinely unknown clientId" — see the comment on
            // isWcStoreHydrated above.
            if (approval.kind === 'wc-sign' && !isWcStoreHydrated) return
            enqueuedRef.current = true

            if (approval.kind === 'wc-sign') {
                // Every WC request is scoped to the session that fired it —
                // resolving/authorizing against ALL wallet accounts here
                // would let a session approved for account A get a request
                // naming account B signed. The offscreen gate deliberately
                // defers this exact check to the pipeline (see
                // packages/walletconnect/src/validation/inboundRequestGate.ts's
                // `gateSignTxnRequest`/`gateSignDataRequest` doc comments).
                const session = connections.find(
                    connection => connection.clientId === approval.clientId,
                )?.session

                if (!session) {
                    // Fails CLOSED explicitly: mirror mobile's
                    // validateRequest (packages/walletconnect/src/hooks/
                    // useWalletConnectHandlers.ts), which throws
                    // WalletConnectInvalidSessionError for a missing session,
                    // rather than letting an empty accounts Set fall through
                    // to the resolver's generic "Unauthorized".
                    logger.debug('[wc-sign] no session found', {
                        clientId: approval.clientId,
                    })
                    setError(
                        describeSignError(
                            new WalletConnectInvalidSessionError(
                                'No session found',
                            ),
                            t,
                        ),
                    )
                    void rejectApproval(requestId)
                    return
                }

                const sourceMetadata = session.peerMeta ?? undefined

                if (approval.method === 'algo_signTxn') {
                    const transactions = readWalletTransactions(
                        approval.payload,
                    )
                    if (!transactions) {
                        logger.error(
                            '[wc-sign] malformed algo_signTxn payload',
                            { requestId },
                        )
                        setError(t('dapp.sign.error.body'))
                        void rejectApproval(requestId)
                        return
                    }
                    try {
                        const resolved = resolve(
                            { transactions },
                            {
                                authorizedAddresses: new Set(session.accounts),
                            },
                        )
                        void enqueue(resolved, {
                            sourceType: 'walletconnect',
                            transportId: approval.clientId,
                            sourceMetadata,
                            respondWithResult: async result => {
                                await resolveWcSign(requestId, result)
                                window.close()
                            },
                            respondWithReject: () => {
                                void rejectApproval(requestId).finally(() =>
                                    window.close(),
                                )
                            },
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

                // algo_signData: reuses the sign-message branch's ARC-60
                // parse/signer-check shape below, but responds with an array
                // of base64 signatures (mirrors mobile's
                // handleArc60SignData, which mimics the legacy algo_signData
                // response shape for WC) rather than the single base64
                // string the injected/webview transport uses.
                const arc60Params = readArc60Params(approval.payload)
                if (!isArc60WirePayload(arc60Params)) {
                    setError(t('dapp.sign.unsupported_message'))
                    void rejectApproval(requestId)
                    return
                }
                try {
                    const { stdSigData, metadata } =
                        parseArc60WireRequest(arc60Params)

                    const signerAccount = accounts.find(
                        account => account.address === stdSigData.signer,
                    )
                    if (
                        !session.accounts.includes(stdSigData.signer) ||
                        !signerAccount ||
                        !canSignArc60(signerAccount, allAccounts)
                    ) {
                        setError(t('dapp.sign.unauthorized_signer'))
                        void rejectApproval(requestId)
                        return
                    }

                    addSignRequest({
                        id: generateOrderedUniqueId(),
                        type: 'arc60',
                        transport: 'callback',
                        sourceType: 'walletconnect',
                        transportId: approval.clientId,
                        sourceMetadata,
                        stdSigData,
                        metadata,
                        approve: async (
                            signed: PeraArbitraryDataSignResult[],
                        ) => {
                            const result = signed.map(item =>
                                encodeToBase64(item.signature),
                            )
                            await resolveWcSign(requestId, result)
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
                    // enqueue is async (fee assignment may hit the network),
                    // but it handles its own failures via respondWithError —
                    // fire-and-forget is safe here, matching the other
                    // transports (webview, WC).
                    void enqueue(resolved, {
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

                // Only accounts granted to THIS origin may be named as the
                // ARC-60 signer. Without it, a dapp connected with account A
                // could request a signature naming account B — a cross-account
                // SIWA impersonation escalation. Transaction signing enforces
                // the same via the resolver's authorizedAddresses.
                const signerAccount = accounts.find(
                    account => account.address === stdSigData.signer,
                )
                if (
                    !approval.approvedAddresses.includes(stdSigData.signer) ||
                    !signerAccount ||
                    !canSignArc60(signerAccount, allAccounts)
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
        }, [
            requestId,
            approval,
            resolve,
            enqueue,
            addSignRequest,
            accounts,
            allAccounts,
            connections,
            isWcStoreHydrated,
            t,
        ])

        // The signing store's queue is persist-backed by chrome.storage.local
        // (shared across extension contexts) and rehydrates unresolved
        // interactive requests, so a stale/foreign request (e.g. a pending
        // multisig-cosign from another window) can be at the queue head when
        // this approval window opens. sign-transactions/sign-message set
        // transportId to requestId; wc-sign sets it to approval.clientId (a
        // WC session, not this approval window, is the correlation unit —
        // mirrors mobile's `connector.clientId`). Correlating on whichever
        // is right for this approval's kind surfaces only the request this
        // screen itself enqueued.
        const correlationId =
            approval?.kind === 'wc-sign' ? approval.clientId : requestId
        const ownRequest =
            currentRequest?.transportId === correlationId
                ? currentRequest
                : null

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
