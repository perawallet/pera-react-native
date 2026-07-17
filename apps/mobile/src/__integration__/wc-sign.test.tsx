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

// Integration coverage for the WalletConnect v1 algo_signTxn dispatch
// and validation layer. Pair flow is covered by `walletconnect-pair.test.tsx`;
// this file picks up where pairing leaves off:
//
//   established session  ─►  connector.fire('algo_signTxn', ...)
//                                   │
//                                   ▼
//                            useWalletConnectHandlers.handleSignTransaction
//                                   │
//                                   ├─►  validates session exists
//                                   ├─►  validates payload shape
//                                   ├─►  ARC-0001 param check
//                                   │
//                                   ├──── on validation throw ─►
//                                   │     connector.rejectRequest
//                                   │     useWalletConnectStore.connectionError
//                                   │
//                                   └──── on success ─►
//                                         signing pipeline (covered by
//                                         send-algo flow tests; the full
//                                         msgpack signing path with real
//                                         Algorand transactions is a
//                                         separate Phase 4 effort).
//
// What this file covers: the rejection paths that don't require real
// msgpack-encoded txns — they're the ones that catch most production
// regressions (dApp sends bad data, session expires mid-flight, etc.)
// and reach `connector.rejectRequest` reliably.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { act, renderHook, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { Address, Transaction, TransactionType } from 'algosdk'
import { encodeTransaction } from '@perawallet/wallet-core-blockchain'

import { createTestQueryClient, render } from '@test-utils/render'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { walletConnectClientStub } from '@test-utils/walletconnect-client-stub'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    AlgorandChainId,
    useWalletConnect,
    useWalletConnectStore,
    type WalletConnectSessionRequest,
} from '@perawallet/wallet-core-walletconnect'
import { Networks, encodeToBase64 } from '@perawallet/wallet-core-shared'
import {
    useSigningRequest,
    type TransactionSignRequest,
} from '@perawallet/wallet-core-signing'
import { WalletConnectProvider } from '@modules/walletconnect/providers/WalletConnectProvider'
import { TransactionListScreen } from '@modules/signing/screens'

import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'

// ---------------------------------------------------------------------------
// Shared fixtures for the external-transaction tests
// ---------------------------------------------------------------------------

const senderA = new Address(new Uint8Array(32).fill(1))
const senderB = new Address(new Uint8Array(32).fill(2))

const baseTxParams = {
    fee: 1000n,
    minFee: 1000n,
    flatFee: true,
    firstValid: 1000n,
    lastValid: 2000n,
    genesisID: 'mainnet-v1.0',
    genesisHash: new Uint8Array(32).fill(0xab),
}

// Canonical testnet genesis hash — the active network in these tests is mainnet,
// so a transaction carrying this hash must be rejected before signing.
const TESTNET_GENESIS_HASH = new Uint8Array(
    Buffer.from('SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=', 'base64'),
)

/** User's payment transaction — will be in `txs` (signable) */
const makeTx0 = () =>
    new Transaction({
        type: TransactionType.pay,
        sender: senderA,
        suggestedParams: baseTxParams,
        paymentParams: { receiver: senderB, amount: 1_000_000n },
    })

/** External party's payment transaction — only in `groupContext` (index 1) */
const makeTx1 = () =>
    new Transaction({
        type: TransactionType.pay,
        sender: senderB,
        suggestedParams: baseTxParams,
        paymentParams: { receiver: senderA, amount: 500_000n },
    })

const SIGNING_ACCOUNT: WalletAccount = {
    id: 'wc-signer',
    type: AccountTypes.algo25,
    address: ALGO25_TEST_ADDRESS,
    keyPairId: 'wc-signer-key',
    name: 'Signer',
}

const SLOW_TEST_TIMEOUT_MS = 30_000

// `useWalletConnect` mounts the signing pipeline, which now reads from
// React-Query via `useMultisigTransportAdapters`. `renderHook` creates a
// fresh React tree separate from the one set up by `render()`, so it
// needs its own QueryClientProvider.
const hookQueryClient = createTestQueryClient()
const HookWrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={hookQueryClient}>
        {children}
    </QueryClientProvider>
)

// Drive a session_request and immediately approve it via the wallet's
// public hook surface — leaves the connector in a "connected" state
// with a session entry in the store, ready for follow-up algo_signTxn
// events.
const pairAndApprove = async () => {
    const { result: wc } = renderHook(
        () => useWalletConnect(Networks.mainnet),
        { wrapper: HookWrapper },
    )
    await act(async () => {
        await wc.current.connect({
            connection: {
                bridge: 'https://relay.example.test',
                uri: `wc:${Math.random()}@1?bridge=https://relay.example.test&key=ff`,
            } as unknown as Parameters<
                typeof wc.current.connect
            >[0]['connection'],
        })
    })
    const connector = walletConnectClientStub.last()
    if (!connector) {
        throw new Error('No connector instance captured')
    }

    const sessionPayload: WalletConnectSessionRequest = {
        peerMeta: {
            name: 'Sign-flow dApp',
            description: '',
            url: 'https://sign.example',
            icons: [],
        },
        chainId: AlgorandChainId.mainnet,
        permissions: ['algo_signTxn'],
        clientId: connector.clientId,
    }
    act(() => {
        connector.fire('session_request', null, {
            params: [sessionPayload],
        })
    })

    await waitFor(() => {
        expect(useWalletConnectStore.getState().sessionRequests).toHaveLength(1)
    })

    // Approve the session via the same hook so the production code path
    // populates `walletConnectConnections` (which `validateRequest` in
    // the sign handler keys off).
    await act(async () => {
        await wc.current.approveSession(connector.clientId, sessionPayload, [
            SIGNING_ACCOUNT.address,
        ])
    })
    await waitFor(() => {
        expect(
            useWalletConnectStore
                .getState()
                .walletConnectConnections.find(
                    c => c.clientId === connector.clientId,
                ),
        ).toBeTruthy()
    })

    return connector
}

describe('Flow: WalletConnect v1 algo_signTxn dispatch + validation', () => {
    beforeEach(() => {
        resetTestKeystore()
        walletConnectClientStub.reset()
        useAccountsStore.getState().setAccounts([SIGNING_ACCOUNT])
        useAccountsStore
            .getState()
            .setSelectedAccountAddress(SIGNING_ACCOUNT.address)
        useWalletConnectStore.getState().setSessionRequests([])
        useWalletConnectStore.getState().setWalletConnectConnections([])
        useWalletConnectStore.getState().setConnectionError(null)
        vi.clearAllMocks()
    })

    afterEach(() => {
        useWalletConnectStore.getState().setSessionRequests([])
        useWalletConnectStore.getState().setWalletConnectConnections([])
        useWalletConnectStore.getState().setConnectionError(null)
        useAccountsStore.getState().setAccounts([])
    })

    it(
        'Given a connector that has not been paired yet, when the dApp fires algo_signTxn, then the request is rejected with WalletConnectInvalidSessionError before any signing is attempted',
        async () => {
            render(
                <WalletConnectProvider>
                    <div data-testid='child' />
                </WalletConnectProvider>,
            )

            // Construct the connector but skip the session_request +
            // approval steps — `validateRequest` should catch the
            // missing session entry and reject before the signing code
            // gets the chance to decode anything.
            const { result: wc } = renderHook(
                () => useWalletConnect(Networks.mainnet),
                { wrapper: HookWrapper },
            )
            await act(async () => {
                await wc.current.connect({
                    connection: {
                        bridge: 'https://relay.example.test',
                        uri: `wc:${Math.random()}@1?bridge=https://relay.example.test&key=ff`,
                    } as unknown as Parameters<
                        typeof wc.current.connect
                    >[0]['connection'],
                })
            })
            const connector = walletConnectClientStub.last()!

            // The provider consumes `connectionError` (shows a toast, then
            // clears the store), so capture the surfaced error as it lands
            // rather than reading it back off the store afterwards.
            const surfaced: { error: Error | null } = { error: null }
            const unsubscribe = useWalletConnectStore.subscribe(state => {
                if (state.connectionError) {
                    surfaced.error = state.connectionError
                }
            })

            const requestId = 9001
            act(() => {
                connector.fire('algo_signTxn', null, {
                    id: requestId,
                    method: 'algo_signTxn',
                    params: [[{ message: 'Sign me', txn: 'BASE64DATA' }]],
                })
            })

            // Production path: `useWalletConnect.connect`'s registered
            // listener wraps `handleSignTransaction` in try/catch, so a
            // synchronous throw lands as `connector.rejectRequest`.
            await waitFor(() => {
                expect(connector.rejectRequestCalls).toHaveLength(1)
            })
            const rejection = connector.rejectRequestCalls[0]
            expect(rejection.id).toBe(requestId)
            expect(rejection.error?.name).toBe(
                'WalletConnectInvalidSessionError',
            )

            // Same throw is dispatched onto the store via `surfaceError`; the
            // provider surfaces it as a toast and then clears the store.
            await waitFor(() => {
                expect(surfaced.error).toBeTruthy()
            })
            expect(surfaced.error?.name).toBe(
                'WalletConnectInvalidSessionError',
            )
            unsubscribe()
            // No success-path side-effect — connector.approveRequest is
            // not called.
            expect(connector.approveRequestCalls).toHaveLength(0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an established session, when the dApp fires algo_signTxn with no params, then the request is rejected with WalletConnectSignRequestError',
        async () => {
            render(
                <WalletConnectProvider>
                    <div data-testid='child' />
                </WalletConnectProvider>,
            )
            const connector = await pairAndApprove()

            // Empty params — the handler validates `payload.params.at(0)`
            // and throws "Invalid data found - parameter required" when
            // it can't find one. This is the "dApp sent garbage" path.
            const requestId = 9002
            act(() => {
                connector.fire('algo_signTxn', null, {
                    id: requestId,
                    method: 'algo_signTxn',
                    params: [],
                })
            })

            await waitFor(() => {
                expect(connector.rejectRequestCalls).toHaveLength(1)
            })
            expect(connector.rejectRequestCalls[0].id).toBe(requestId)
            expect(connector.rejectRequestCalls[0].error?.name).toBe(
                'WalletConnectSignRequestError',
            )
            expect(connector.approveRequestCalls).toHaveLength(0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an established session, when the dApp fires algo_signTxn with an ARC-0001 violation (signer not in session), then the request is rejected before signing pipeline starts',
        async () => {
            render(
                <WalletConnectProvider>
                    <div data-testid='child' />
                </WalletConnectProvider>,
            )
            const connector = await pairAndApprove()

            // ARC-0001 requires `authAddr` (when present) to be a valid
            // base32 Algorand address. Passing garbage here trips the
            // address-validity check in `resolveArc0001SignTxnRequest`,
            // which throws Arc0001Error(4300) before the msgpack decoder
            // runs. This is the "dApp encoded the request wrong" path.
            const requestId = 9003
            act(() => {
                connector.fire('algo_signTxn', null, {
                    id: requestId,
                    method: 'algo_signTxn',
                    params: [
                        [
                            {
                                message: 'Sign me',
                                txn: 'BASE64DATA',
                                authAddr: 'NOT_A_REAL_ADDRESS',
                            },
                        ],
                    ],
                })
            })

            await waitFor(() => {
                expect(connector.rejectRequestCalls).toHaveLength(1)
            })
            expect(connector.rejectRequestCalls[0].id).toBe(requestId)
            // The resolver surfaces ARC-0001's numeric error codes via
            // `Arc0001Error` so dApps see `{ code: 4300, … }` rather than
            // a generic message. 4300 is "invalid input".
            const rejected = connector.rejectRequestCalls[0].error as
                | (Error & { code?: number })
                | undefined
            expect(rejected?.name).toBe('Arc0001Error')
            expect(rejected?.code).toBe(4300)
            // Signing pipeline never reaches the success branch.
            expect(connector.approveRequestCalls).toHaveLength(0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an established mainnet session, when the dApp fires algo_signTxn with a testnet genesis hash, then the request is rejected before any signature is produced',
        async () => {
            render(
                <WalletConnectProvider>
                    <div data-testid='child' />
                </WalletConnectProvider>,
            )
            const connector = await pairAndApprove()

            // Build a transaction whose genesisHash is testnet — the active
            // network in this test is mainnet, so the standard analyzer's
            // assertTransactionsMatchNetwork call must reject it. The sender
            // must be the session's signing account so the ARC-0001 resolver
            // places the transaction in `toSign` (an empty toSign short-circuits
            // before analysis, bypassing the genesis-hash check entirely).
            const foreignNetworkTx = new Transaction({
                type: TransactionType.pay,
                sender: Address.fromString(SIGNING_ACCOUNT.address),
                suggestedParams: {
                    fee: 1000n,
                    minFee: 1000n,
                    flatFee: true,
                    firstValid: 1000n,
                    lastValid: 2000n,
                    genesisID: 'testnet-v1.0',
                    genesisHash: TESTNET_GENESIS_HASH,
                },
                paymentParams: { receiver: senderB, amount: 1_000_000n },
            })
            const txnBase64 = encodeToBase64(
                encodeTransaction(foreignNetworkTx),
            )

            const requestId = 9004
            act(() => {
                connector.fire('algo_signTxn', null, {
                    id: requestId,
                    method: 'algo_signTxn',
                    params: [[{ txn: txnBase64 }]],
                })
            })

            // The standard analyzer throws GenesisHashMismatchError; the
            // signing machine calls respondWithError, which calls
            // connector.rejectRequest. Approval is never delivered.
            await waitFor(() => {
                expect(connector.rejectRequestCalls).toHaveLength(1)
            })
            expect(connector.rejectRequestCalls[0].id).toBe(requestId)
            // Pin the rejection to the genesis-hash cause so a future
            // regression rejecting for an unrelated reason cannot pass
            // vacuously. The error flows from GenesisHashMismatchError
            // through toError (identity for Error instances) → req.error
            // → respondWithError, arriving at rejectRequest unwrapped.
            expect(connector.rejectRequestCalls[0].error?.name).toBe(
                'GenesisHashMismatchError',
            )
            expect(connector.approveRequestCalls).toHaveLength(0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'shows the Other signer pill for the external transaction in the signing list',
        async () => {
            // Two-transaction request where only index 0 belongs to the
            // wallet. Index 1 has a different sender and is not in `txs`,
            // so `signableIndices: [0]` marks it as external. The signing
            // pipeline renders every `groupContext` transaction but stamps
            // `isExternal: true` on the slot the wallet won't sign. The
            // transactions are ungrouped here (no `group` byte set); the
            // atomic-group-expansion path of `createTransactionListItems`
            // is covered by unit tests in classification.spec.ts.
            //
            // NOTE: navigation to the detail screen is omitted here.
            // `renderWithNavigation` mounts the test navigator which registers
            // the stack, but navigating to `TransactionDetails` from an item
            // press requires the item to be tappable in the jsdom environment
            // (the pill tap opens a bottom sheet, not navigation). The
            // list-level assertion is sufficient to cover Task 7 (isExternal
            // wired through TransactionListScreen) end-to-end.
            const tx0 = makeTx0()
            const tx1 = makeTx1()

            const request: TransactionSignRequest = {
                id: 'external-pill-test',
                type: 'transactions',
                transport: 'callback',
                sourceType: 'walletconnect',
                txs: [tx0],
                groupContext: [tx0, tx1],
                signableIndices: [0],
                approve: async () => {},
                reject: async () => {},
                error: async () => {},
            }

            // Seed the signing store so useSigningPipeline picks it up as
            // `currentRequest` and computes listItems with isExternal flags.
            const { result: req } = renderHook(() => useSigningRequest(), {
                wrapper: HookWrapper,
            })
            act(() => {
                req.current.addSignRequest(request)
            })

            renderWithNavigation(TransactionListScreen, 'TransactionList')

            // The pipeline stamps isExternal: true on groupContext[1] and
            // TransactionPreview renders the pill with this i18n key.
            // In the integration test environment the t() function returns
            // the key as-is (i18n is not initialized in the test setup).
            await waitFor(() => {
                expect(
                    screen.getByText('signing.external_transaction.pill_label'),
                ).toBeTruthy()
            })

            // Only the external row gets the pill — the user's own tx must
            // not show it.
            expect(
                screen.getAllByText('signing.external_transaction.pill_label'),
            ).toHaveLength(1)

            // Clean up: remove the request so the actor stops and the store
            // is back to a known-clean state for subsequent tests.
            act(() => {
                req.current.removeSignRequest(request)
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a session imported by migration after the provider already mounted, when the imported session is written to the store, then a live connector with the sign handler is reconciled without a cold relaunch',
        async () => {
            render(
                <WalletConnectProvider>
                    <div data-testid='child' />
                </WalletConnectProvider>,
            )

            // Ignore connectors from the empty-store mount.
            walletConnectClientStub.reset()

            const migratedConnection = {
                clientId: 'migrated-client',
                version: 1,
                bridge: 'https://relay.example.test',
                connected: false,
                createdAt: new Date(0),
                session: {
                    connected: true,
                    accounts: [SIGNING_ACCOUNT.address],
                    chainId: AlgorandChainId.mainnet,
                    bridge: 'https://relay.example.test',
                    key: 'migrated-key',
                    clientId: 'migrated-client',
                    peerId: 'migrated-peer',
                    peerMeta: {
                        name: 'Migrated dApp',
                        url: 'https://migrated.example',
                        icons: [],
                        description: '',
                    },
                    handshakeId: 0,
                    handshakeTopic: 'migrated-topic',
                },
            }

            act(() => {
                useWalletConnectStore
                    .getState()
                    .setWalletConnectConnections([migratedConnection as never])
            })

            await waitFor(() => {
                expect(
                    walletConnectClientStub.instances.length,
                ).toBeGreaterThan(0)
            })
            expect(
                walletConnectClientStub.last()!.handlers.has('algo_signTxn'),
            ).toBe(true)
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
