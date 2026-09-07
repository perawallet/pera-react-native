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

// The shipped connections path: `ConnectionsProvider` → the registry → the
// WalletConnect v1 handler → `ConnectionApprovalView` → the signing adapter.
// `connections-origin.test.tsx` covers what the pairing origin does after
// approval and `connections-quantum-fee.test.tsx` the quantum fee override.
//
// Only the bottom-level `@perawallet/walletconnect` transport is stubbed (via
// vitest resolve.alias); the provider, registry, handler, approval sheet and
// signing adapter are all production code.

import React, { useEffect, useRef } from 'react'
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type MockInstance,
} from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { Address, Transaction, TransactionType } from 'algosdk'
import { http, HttpResponse } from 'msw'
import {
    decodeSignedTransaction,
    encodeTransaction,
    encodeTransactionRaw,
    rawTransactionsMatch,
    useNetworkStore,
} from '@perawallet/wallet-core-blockchain'
import {
    mockAlgodAccountInformation,
    mockAlgodStatus,
    mockAlgodTransactionParams,
    mockIndexerSearchForAccounts,
} from '@perawallet/wallet-core-blockchain/test-handlers'

import { render } from '@test-utils/render'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { server } from '@test-utils/msw-server'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    buildPaymentTransaction,
    seedAlgo25Signer,
} from '@test-utils/signing-review'
import { walletConnectClientStub } from '@test-utils/walletconnect-client-stub'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    usePreferences,
    useSettingsStore,
} from '@perawallet/wallet-core-settings'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { AlgorandChainId } from '@perawallet/wallet-core-walletconnect'
import {
    useConnectionRegistry,
    type ConnectionRegistryClient,
} from '@perawallet/wallet-core-connections'
import type { ConnectionOrigin } from '@perawallet/wallet-extension-connections'
import {
    decodeFromBase64,
    encodeToBase64,
    Networks,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { ConnectionsProvider } from '@modules/connections'
import { BottomSheetManager } from '@modules/bottom-sheet'
import { SigningOverlays } from '@modules/signing/components/SigningOverlays'
import { UserPreferences } from '@constants/user-preferences'

import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'
import { QUANTUM_TEST_ADDRESS } from './__fixtures__/quantum'

const SIGNING_ACCOUNT: WalletAccount = {
    id: 'conn-a',
    type: AccountTypes.algo25,
    address: ALGO25_TEST_ADDRESS,
    keyPairId: 'conn-a-key',
    name: 'Trading',
}
const OTHER_ACCOUNT: WalletAccount = {
    id: 'conn-b',
    type: AccountTypes.algo25,
    address: HD_TEST_ADDRESS,
    keyPairId: 'conn-b-key',
    name: 'DeFi',
}

// No key behind it: the approval gate only asks which account TYPE is selected.
const QUANTUM_ACCOUNT: WalletAccount = {
    id: 'conn-q',
    type: AccountTypes.quantum,
    address: QUANTUM_TEST_ADDRESS,
    keyPairId: 'conn-q-key',
    name: 'Falcon',
}

const SLOW_TEST_TIMEOUT_MS = 30_000
const SLIDE_TEST_ID = 'signing-confirm-slide'
const QUANTUM_DAPP_WARNING_TEST_ID = 'quantum-dapp-warning-sheet'

// Canonical testnet genesis hash — the active network in these tests is
// mainnet, so a transaction carrying this hash must be rejected before signing.
// Re-wrapped so it is the same realm algosdk's constructor validates against.
const TESTNET_GENESIS_HASH = new Uint8Array(
    decodeFromBase64('SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI='),
)

// 'in-app' suppresses the post-approval success sheet, which would otherwise
// sit over the surface the next sheet needs.
const IN_APP_ORIGIN: ConnectionOrigin = { source: 'in-app' }

// The registry lives inside the provider, so the only honest way to start a
// pairing is the hook every real caller uses.
const captured: { registry: Optional<ConnectionRegistryClient> } = {
    registry: undefined,
}
const RegistryProbe = () => {
    captured.registry = useConnectionRegistry()
    return null
}

const findButton = (label: string): Optional<HTMLButtonElement> =>
    screen
        .getAllByRole('button')
        .find(button =>
            (button.textContent ?? '').includes(label),
        ) as Optional<HTMLButtonElement>

const rowFor = (name: string): HTMLButtonElement => {
    const matches = screen.getAllByText((_, node) =>
        (node?.textContent ?? '').includes(name),
    )
    const leaf = matches.find(el => el.children.length === 0) ?? matches[0]
    const button = leaf.closest('button')
    if (!button) throw new Error(`Row not found for "${name}"`)
    return button as HTMLButtonElement
}

const mountProvider = async () => {
    render(
        <>
            <ConnectionsProvider>
                <RegistryProbe />
            </ConnectionsProvider>
            <BottomSheetManager />
        </>,
    )
    await waitFor(() => {
        expect(captured.registry).toBeTruthy()
    })
}

/**
 * The provider next to the review sheet, as `RootComponent` mounts them: the
 * signing adapter inside `ConnectionsProvider` enqueues the request and
 * `SigningOverlays` is what turns it into a signature. The once-per-device
 * request FAQ is pre-acknowledged so it cannot open a competing sheet.
 */
const ConnectionsWithSigning = () => {
    const { setPreference } = usePreferences()
    const acknowledged = useRef(false)
    useEffect(() => {
        if (acknowledged.current) return
        acknowledged.current = true
        setPreference('hasSeenTransactionRequestFAQ', true)
    }, [setPreference])

    return (
        <ConnectionsProvider>
            <RegistryProbe />
            <SigningOverlays />
        </ConnectionsProvider>
    )
}

// Inside a navigator: the review sheet's own screens use navigation, and
// `renderWithNavigation` mounts the one `BottomSheetManager` both the approval
// and the signing sheets are requested from.
const mountProviderWithSigning = async () => {
    renderWithNavigation(ConnectionsWithSigning, 'ConnectionsWithSigning')
    await waitFor(() => {
        expect(captured.registry).toBeTruthy()
    })
}

/** Pairs and delivers a handshake the way the relay would. */
const pairAndHandshake = async (
    peerName: string,
    opts?: { url?: string; origin?: ConnectionOrigin },
) => {
    await act(async () => {
        await captured.registry!.pair(
            `wc:${Math.random()}@1?bridge=https://relay.example.test&key=ff`,
            opts?.origin ? { origin: opts.origin } : undefined,
        )
    })
    const connector = walletConnectClientStub.last()
    if (!connector) throw new Error('No connector instance captured')

    act(() => {
        connector.fire('session_request', null, {
            id: 42,
            params: [
                {
                    peerMeta: {
                        name: peerName,
                        description: '',
                        url: opts?.url ?? 'https://connections-dapp.example',
                        icons: [],
                    },
                    chainId: AlgorandChainId.mainnet,
                    permissions: ['algo_signTxn'],
                },
            ],
        })
    })
    return connector
}

const payTransactionFrom = (sender: string): Transaction =>
    new Transaction({
        type: TransactionType.pay,
        sender: Address.fromString(sender),
        suggestedParams: {
            fee: 1000n,
            minFee: 1000n,
            flatFee: true,
            firstValid: 1000n,
            lastValid: 2000n,
            genesisID: 'mainnet-v1.0',
            genesisHash: new Uint8Array(32).fill(0xab),
        },
        paymentParams: {
            receiver: Address.fromString(SIGNING_ACCOUNT.address),
            amount: 1_000_000n,
        },
    })

const approveViaUi = async (accountName: string) => {
    await waitFor(() => {
        expect(findButton('common.connect.label')).toBeTruthy()
    })
    fireEvent.click(rowFor(accountName))
    await waitFor(() => {
        expect(findButton('common.connect.label')!.disabled).toBe(false)
    })
    fireEvent.click(findButton('common.connect.label')!)
}

// `approveSession` fires before the record is written, and the handler answers
// a follow-up request against the STORED session.
const waitForStoredConnection = async (clientId: string) => {
    await waitFor(async () => {
        expect(await getProvider().connections.store.get(clientId)).toBeTruthy()
    })
}

describe('Flow: ConnectionsProvider pair → approve → sign', () => {
    beforeEach(async () => {
        resetTestKeystore()
        walletConnectClientStub.reset()
        captured.registry = undefined
        useAccountsStore
            .getState()
            .setAccounts([SIGNING_ACCOUNT, OTHER_ACCOUNT])
        useAccountsStore
            .getState()
            .setSelectedAccountAddress(SIGNING_ACCOUNT.address)
        await getProvider().connections.store.clear()
        vi.clearAllMocks()
    })

    afterEach(async () => {
        await getProvider().connections.store.clear()
        useAccountsStore.getState().setAccounts([])
        useRemoteConfigStore.getState().resetState()
    })

    it(
        'Given a dApp pairs through the registry, when the user picks one account and taps Connect, then approveSession carries that exact address list and the connection is persisted',
        async () => {
            await mountProvider()
            const connector = await pairAndHandshake('Connections dApp')

            await approveViaUi(SIGNING_ACCOUNT.name as string)

            await waitFor(() => {
                expect(connector.approveSessionCalls).toHaveLength(1)
            })
            const call = connector.approveSessionCalls[0]
            expect(call.chainId).toBe(AlgorandChainId.mainnet)
            expect(call.accounts).toEqual([SIGNING_ACCOUNT.address])

            const stored = await getProvider().connections.store.list()
            expect(stored.map(connection => connection.id)).toEqual([
                connector.clientId,
            ])
            // The session key never reaches the record — it lives in the
            // keystore behind `secretRef`.
            expect(stored[0].accounts).toEqual([SIGNING_ACCOUNT.address])
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a session approved for one account, when the dApp asks to sign for another the wallet holds, then the peer is rejected rather than left waiting',
        async () => {
            // The branch's headline security property. The refusal is a THROW
            // out of the ARC-0001 resolver, and the legacy hook's synchronous
            // try/catch used to be what turned that into a `rejectRequest`.
            // Nothing inherited that job when the hook went — so "nothing was
            // signed" is only half of it, and this is the guard on the other
            // half: the dApp must hear back rather than time out.
            await mountProvider()
            const connector = await pairAndHandshake('Rejecting dApp')
            await approveViaUi(SIGNING_ACCOUNT.name as string)
            await waitForStoredConnection(connector.clientId)

            // Sender is OTHER_ACCOUNT: signable by the wallet, but never
            // approved for this session.
            const unauthorized = payTransactionFrom(OTHER_ACCOUNT.address)

            const requestId = 9101
            act(() => {
                connector.fire('algo_signTxn', null, {
                    id: requestId,
                    method: 'algo_signTxn',
                    params: [
                        [
                            {
                                txn: encodeToBase64(
                                    encodeTransaction(unauthorized),
                                ),
                            },
                        ],
                    ],
                })
            })

            await waitFor(() => {
                expect(connector.rejectRequestCalls).toHaveLength(1)
            })
            expect(connector.rejectRequestCalls[0].id).toBe(requestId)
            const rejected = connector.rejectRequestCalls[0].error as
                | (Error & { code?: number })
                | undefined
            // 4100 is ARC-0001's `Unauthorized`.
            expect(rejected?.code).toBe(4100)
            expect(connector.approveRequestCalls).toHaveLength(0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an open proposal, when the user taps Cancel, then nothing is persisted and the pairing socket is closed',
        async () => {
            await mountProvider()
            const connector = await pairAndHandshake('Declined dApp')

            await waitFor(() => {
                expect(findButton('common.cancel.label')).toBeTruthy()
            })
            await act(async () => {
                fireEvent.click(findButton('common.cancel.label')!)
            })

            await waitFor(() => {
                expect(connector.rejectSessionCalls).toBe(1)
            })
            expect(await getProvider().connections.store.list()).toEqual([])
            // The SDK's `rejectSession` forgets the connector synchronously
            // and leaves the socket open, so only a teardown by reference
            // stops a late `session_request` popping a ghost approval sheet.
            expect(connector.transportCloseCalls).toBe(1)
            expect(connector.approveSessionCalls).toHaveLength(0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an approved session, when it is revoked through the registry, then the peer is killed and the record is gone',
        async () => {
            await mountProvider()
            const connector = await pairAndHandshake('Revoked dApp')
            await approveViaUi(SIGNING_ACCOUNT.name as string)
            await waitForStoredConnection(connector.clientId)

            await act(async () => {
                await captured.registry!.disconnect(connector.clientId)
            })

            expect(connector.killSessionCalls).toHaveLength(1)
            expect(await getProvider().connections.store.list()).toEqual([])
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a second dApp handshakes while the first proposal is on screen, when the first settles, then the second opens instead of being dropped',
        async () => {
            // `subscribeToProposals` is an unbuffered fan-out: without the
            // provider's queue the second dApp would wait out its own TTL.
            await mountProvider()
            const first = await pairAndHandshake('First dApp', {
                url: 'https://first.example',
                // The success sheet would otherwise hold the queue until the
                // user dismissed it.
                origin: IN_APP_ORIGIN,
            })
            const second = await pairAndHandshake('Second dApp', {
                url: 'https://second.example',
                origin: IN_APP_ORIGIN,
            })

            await waitFor(() => {
                expect(findButton('https://first.example')).toBeTruthy()
            })
            expect(findButton('https://second.example')).toBeUndefined()

            await approveViaUi(SIGNING_ACCOUNT.name as string)

            await waitFor(() => {
                expect(findButton('https://second.example')).toBeTruthy()
            })
            await approveViaUi(OTHER_ACCOUNT.name as string)

            await waitFor(() => {
                expect(second.approveSessionCalls).toHaveLength(1)
            })
            expect(first.approveSessionCalls[0].accounts).toEqual([
                SIGNING_ACCOUNT.address,
            ])
            expect(second.approveSessionCalls[0].accounts).toEqual([
                OTHER_ACCOUNT.address,
            ])
            const stored = await getProvider().connections.store.list()
            expect(stored.map(connection => connection.origin?.source)).toEqual(
                ['in-app', 'in-app'],
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an approved session, when the dApp asks to sub-sign a multisig slot, then the peer is rejected 4200 rather than shown an ordinary signing sheet',
        async () => {
            // The `msig` slot reaches the resolver only because the request
            // schema is the resolver's own: a hand-written copy would strip
            // the field and turn this refusal into a signing sheet.
            await mountProvider()
            const connector = await pairAndHandshake('Multisig dApp')
            await approveViaUi(SIGNING_ACCOUNT.name as string)
            await waitForStoredConnection(connector.clientId)

            const requestId = 9202
            act(() => {
                connector.fire('algo_signTxn', null, {
                    id: requestId,
                    method: 'algo_signTxn',
                    params: [
                        [
                            {
                                txn: encodeToBase64(
                                    encodeTransaction(
                                        payTransactionFrom(
                                            SIGNING_ACCOUNT.address,
                                        ),
                                    ),
                                ),
                                msig: {
                                    version: 1,
                                    threshold: 2,
                                    addrs: [
                                        SIGNING_ACCOUNT.address,
                                        OTHER_ACCOUNT.address,
                                    ],
                                },
                            },
                        ],
                    ],
                })
            })

            await waitFor(() => {
                expect(connector.rejectRequestCalls).toHaveLength(1)
            })
            expect(connector.rejectRequestCalls[0].id).toBe(requestId)
            const rejected = connector.rejectRequestCalls[0].error as
                | (Error & { code?: number })
                | undefined
            // 4200 is ARC-0001's `Unsupported`.
            expect(rejected?.code).toBe(4200)
            expect(connector.approveRequestCalls).toHaveLength(0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an established session, when the dApp fires algo_signTxn with no params, then the request is rejected as a malformed sign request before anything is enqueued',
        async () => {
            await mountProvider()
            const connector = await pairAndHandshake('Garbage dApp')
            await approveViaUi(SIGNING_ACCOUNT.name as string)
            await waitForStoredConnection(connector.clientId)

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
        'Given a quantum account is selected, when the user taps Connect, then the warning sheet appears once even on a double tap, and Cancel rejects the session without persisting it',
        async () => {
            await useRemoteConfigStore.persist.rehydrate()
            useRemoteConfigStore
                .getState()
                .setConfigOverride('enable_quantum_accounts', true)
            // The acknowledgement is a persisted preference on a singleton
            // store, so a prior test's Continue would hide the warning here.
            useSettingsStore
                .getState()
                .deletePreference(
                    UserPreferences.quantumDappWarningAcknowledged,
                )
            useAccountsStore
                .getState()
                .setAccounts([SIGNING_ACCOUNT, QUANTUM_ACCOUNT])
            await mountProvider()
            const connector = await pairAndHandshake('Quantum dApp')

            await approveViaUi(QUANTUM_ACCOUNT.name as string)

            await waitFor(() => {
                expect(
                    screen.getByTestId(QUANTUM_DAPP_WARNING_TEST_ID),
                ).toBeTruthy()
            })
            // The sheet's own request is still pending, so this lands while
            // `confirmQuantumDappUsage`'s await is genuinely unresolved.
            fireEvent.click(findButton('common.connect.label')!)
            expect(
                screen.getAllByTestId(QUANTUM_DAPP_WARNING_TEST_ID),
            ).toHaveLength(1)

            fireEvent.click(findButton('quantum.dapp_warning.cancel')!)

            await waitFor(() => {
                expect(connector.rejectSessionCalls).toBe(1)
            })
            expect(connector.approveSessionCalls).toHaveLength(0)
            expect(await getProvider().connections.store.list()).toEqual([])
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    // Own suite because the success path is the only one that reaches the
    // signing pipeline: it needs a real key in the keystore, algod for
    // suggested params and the asset database the review sheet reads. The
    // refusals above reach their verdict before any of that.
    describe('through the signing pipeline', () => {
        // The in-memory keystore signs ed25519 with 64 zero bytes, and
        // algosdk's canonical encoding DROPS an all-zero fixed-size field — so
        // a signed transaction and an unsigned one are the same bytes on the
        // wire. A visible signature is what lets the assertion below fail.
        const VISIBLE_SIGNATURE = new Uint8Array(64).fill(7)
        type KeyStoreSign = ReturnType<
            typeof getProvider
        >['key']['store']['sign']
        let signSpy: MockInstance<KeyStoreSign>

        beforeAll(async () => {
            server.listen({ onUnhandledRequest: 'warn' })
            await setupTestDatabase()
        })
        afterAll(async () => {
            server.close()
            await teardownTestDatabase()
        })
        afterEach(() => {
            server.resetHandlers()
            signSpy.mockRestore()
        })

        beforeEach(async () => {
            await resetTestDatabase()
            await seedAlgoAsset('mainnet')
            useNetworkStore.getState().setNetwork(Networks.mainnet)
            signSpy = vi
                .spyOn(getProvider().key.store, 'sign')
                .mockResolvedValue(VISIBLE_SIGNATURE)
            server.use(
                // The review sheet looks the peer's url up in the projects
                // API; left unmocked it is a real network round-trip.
                http.get('*/v1/projects/', () => HttpResponse.json([])),
                mockAlgodTransactionParams({
                    response: { fee: 1000, 'min-fee': 1000 },
                }),
                mockAlgodAccountInformation({
                    address: ALGO25_TEST_ADDRESS,
                    response: { amount: 5_000_000, 'min-balance': 100_000 },
                }),
                mockAlgodAccountInformation({
                    address: HD_TEST_ADDRESS,
                    response: { amount: 5_000_000, 'min-balance': 100_000 },
                }),
                mockAlgodStatus({ response: { 'last-round': 100 } }),
                mockIndexerSearchForAccounts(),
            )
        })

        it(
            'Given a session approved for an account the wallet holds, when the dApp requests a signature and the user confirms, then the peer is answered once with a signed transaction carrying the bytes it asked for',
            async () => {
                // The branch's headline claim, end to end on the shipped path:
                // provider → registry → v1 handler → signing adapter →
                // ARC-0001 resolver → review sheet → `respond` →
                // `toWireResult` → the connector. Only the relay socket is a
                // stub.
                const signer = await seedAlgo25Signer()
                await mountProviderWithSigning()
                const connector = await pairAndHandshake('Signing dApp', {
                    origin: IN_APP_ORIGIN,
                })
                await approveViaUi(signer.name as string)
                await waitForStoredConnection(connector.clientId)

                const requested = buildPaymentTransaction({
                    sender: signer.address,
                    receiver: HD_TEST_ADDRESS,
                    amount: 1_000_000n,
                })
                // ARC-0001 carries the UNPREFIXED msgpack, which is what the
                // delivered signed transaction is compared against below.
                const requestedTxn = encodeToBase64(
                    encodeTransactionRaw(requested),
                )
                const requestId = 9303
                act(() => {
                    connector.fire('algo_signTxn', null, {
                        id: requestId,
                        method: 'algo_signTxn',
                        params: [[{ txn: requestedTxn }]],
                    })
                })

                await waitFor(
                    () => {
                        expect(screen.getByTestId(SLIDE_TEST_ID)).toBeTruthy()
                    },
                    { timeout: 15_000 },
                )
                fireEvent.click(screen.getByTestId(SLIDE_TEST_ID))

                await waitFor(
                    () => {
                        expect(connector.approveRequestCalls).toHaveLength(1)
                    },
                    { timeout: 15_000 },
                )
                expect(connector.approveRequestCalls[0].id).toBe(requestId)
                const result = connector.approveRequestCalls[0]
                    .result as Nullable<string>[]
                // ARC-0001 slot-order contract: one entry per requested txn.
                expect(result).toHaveLength(1)
                const carrier = result[0]
                if (!carrier) throw new Error('the peer got no signed slot')

                const signed = decodeSignedTransaction(
                    decodeFromBase64(carrier),
                )
                // The signature the peer got is the one the keystore produced,
                // over the requested transaction's own signing bytes.
                expect(signed.sig).toEqual(VISIBLE_SIGNATURE)
                expect(signSpy).toHaveBeenCalledTimes(1)
                expect(encodeToBase64(signSpy.mock.calls[0][1])).toBe(
                    encodeToBase64(encodeTransaction(requested)),
                )
                // And the transaction inside the envelope is the dApp's own
                // bytes, not something the wallet re-encoded.
                expect(
                    rawTransactionsMatch(
                        [requestedTxn],
                        [encodeToBase64(encodeTransactionRaw(signed.txn))],
                    ),
                ).toBe(true)
                expect(connector.rejectRequestCalls).toHaveLength(0)
            },
            SLOW_TEST_TIMEOUT_MS,
        )

        it(
            'Given a mainnet session, when the dApp requests a signature over a transaction carrying the testnet genesis hash, then the peer is rejected for the genesis-hash mismatch and no signature is produced',
            async () => {
                // The chain-id gate passes (the session IS mainnet); this is
                // the analyzer's own safety net, reached only through the
                // signing pipeline. The sender is the session's account so the
                // resolver places the transaction in `toSign` — an empty
                // toSign short-circuits before analysis.
                const signer = await seedAlgo25Signer()
                await mountProviderWithSigning()
                const connector = await pairAndHandshake('Foreign-chain dApp', {
                    origin: IN_APP_ORIGIN,
                })
                await approveViaUi(signer.name as string)
                await waitForStoredConnection(connector.clientId)

                const foreign = new Transaction({
                    type: TransactionType.pay,
                    sender: Address.fromString(signer.address),
                    suggestedParams: {
                        fee: 1000n,
                        minFee: 1000n,
                        flatFee: true,
                        firstValid: 1000n,
                        lastValid: 2000n,
                        genesisID: 'testnet-v1.0',
                        genesisHash: TESTNET_GENESIS_HASH,
                    },
                    paymentParams: {
                        receiver: Address.fromString(HD_TEST_ADDRESS),
                        amount: 1_000_000n,
                    },
                })
                const requestId = 9404
                act(() => {
                    connector.fire('algo_signTxn', null, {
                        id: requestId,
                        method: 'algo_signTxn',
                        params: [
                            [
                                {
                                    txn: encodeToBase64(
                                        encodeTransactionRaw(foreign),
                                    ),
                                },
                            ],
                        ],
                    })
                })

                await waitFor(
                    () => {
                        expect(connector.rejectRequestCalls).toHaveLength(1)
                    },
                    { timeout: 15_000 },
                )
                expect(connector.rejectRequestCalls[0].id).toBe(requestId)
                // Pinned to the cause so an unrelated rejection cannot pass
                // vacuously.
                expect(connector.rejectRequestCalls[0].error?.name).toBe(
                    'GenesisHashMismatchError',
                )
                expect(connector.approveRequestCalls).toHaveLength(0)
                expect(signSpy).not.toHaveBeenCalled()
            },
            SLOW_TEST_TIMEOUT_MS,
        )
    })
})
