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

// The quantum fee override across the shipped connections path:
// `ConnectionsProvider` → the registry → the WalletConnect v1 handler → the
// signing adapter → the ARC-0001 resolver → the review sheet → `respond` →
// the connector. `sign-review-quantum-fee.test.tsx` mounts only the review
// surface; this is the one that drives a real `algo_signTxn` through the
// connector stub end to end.
//
// Scenario (a) is the quantum path (fee raised to the PQ minimum, regrouped,
// "Adjusted" marker shown); scenario (b) proves an algo25 request stays
// byte-identical, so the override never touches ordinary dApp traffic.

import React, { useEffect, useRef, useState } from 'react'
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import {
    act,
    fireEvent,
    renderHook,
    screen,
    waitFor,
} from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'

import { createTestQueryClient, render } from '@test-utils/render'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { walletConnectClientStub } from '@test-utils/walletconnect-client-stub'
import { server } from '@test-utils/msw-server'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    buildPaymentTransaction,
    seedAlgo25Signer,
    seedQuantumSigner,
    REVIEW_SIGNER_ADDRESS,
} from '@test-utils/signing-review'
import {
    AccountTypes,
    useAccountsStore,
    type QuantumAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useKMS, type QuantumKeyResult } from '@perawallet/wallet-core-kms'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import {
    useSettingsStore,
    usePreferences,
} from '@perawallet/wallet-core-settings'
import {
    decodeSignedTransaction,
    encodeTransactionRaw,
    groupTransactions,
    rawTransactionsMatch,
    useNetworkStore,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import {
    mockAlgodAccountInformation,
    mockAlgodStatus,
    mockAlgodTransactionParams,
    mockIndexerSearchForAccounts,
} from '@perawallet/wallet-core-blockchain/test-handlers'
import {
    bytesEqual,
    decodeFromBase64,
    encodeToBase64,
    Networks,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    useSigningRequest,
    type TransactionSignRequest,
} from '@perawallet/wallet-core-signing'
import { AlgorandChainId } from '@perawallet/wallet-core-walletconnect'
import {
    useConnectionRegistry,
    type ConnectionPairingResult,
    type ConnectionRegistryClient,
} from '@perawallet/wallet-core-connections'
import type { ConnectionOrigin } from '@perawallet/wallet-extension-connections'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { ConnectionsProvider, useConnectionPairing } from '@modules/connections'
import { BottomSheetManager } from '@modules/bottom-sheet'
import { SigningOverlays } from '@modules/signing/components/SigningOverlays'
import { QUANTUM_FEE_EXPLAINER_TEST_ID } from '@modules/transactions/components/QuantumFeeExplainer'
import { UserPreferences } from '@constants/user-preferences'

import { HD_TEST_ADDRESS } from './__fixtures__/onboarding'
import {
    QUANTUM_TEST_ADDRESS,
    QUANTUM_TEST_MNEMONIC_INDICES,
} from './__fixtures__/quantum'

const SLOW_TEST_TIMEOUT_MS = 30_000
const QUANTUM_FLAG = 'enable_quantum_accounts'
const ADJUSTED_LABEL_KEY = 'transactions.quantum_fee.adjusted_label'
const EXTERNAL_PILL_KEY = 'signing.external_transaction.pill_label'
const SLIDE_TEST_ID = 'signing-confirm-slide'
const QUANTUM_DAPP_WARNING_TEST_ID = 'quantum-dapp-warning-sheet'

// The base 1000 µAlgo minimum × the fallback PQ multiplier (3) — what the
// override raises a quantum signer's fee to given `min-fee: 1000` from algod
// and the default remote config.
const EXPECTED_PQ_FEE = 3000n

// 'in-app' suppresses the post-approval success sheet, which would otherwise
// sit over the surface the review sheet needs.
const IN_APP_ORIGIN: ConnectionOrigin = { source: 'in-app' }

const hookQueryClient = createTestQueryClient()
const HookWrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={hookQueryClient}>
        {children}
    </QueryClientProvider>
)

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

/**
 * Mint a REAL quantum (Falcon) key from the pinned quantum mnemonic and
 * register the derived quantum account so the signing machine can produce a
 * genuine pqsig carrier.
 */
const seedQuantumSender = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let keyResult: Nullable<QuantumKeyResult> = null
    await waitFor(async () => {
        keyResult = await kms.current.createQuantumKey({
            mnemonicIndices: QUANTUM_TEST_MNEMONIC_INDICES,
        })
        expect(keyResult).not.toBeNull()
    })
    const account: QuantumAccount = {
        id: 'wc-quantum-signer',
        type: AccountTypes.quantum,
        address: QUANTUM_TEST_ADDRESS,
        keyPairId: keyResult!.signKeyId,
        name: 'Quantum WC signer',
    }
    useAccountsStore.getState().setAccounts([account])
    useAccountsStore.getState().setSelectedAccountAddress(account.address)
    return account
}

// The signing store is a module singleton with no per-test reset: a test that
// aborts mid-review leaves its request behind and the next review sheet
// renders it instead of its own.
const drainPendingSignRequests = () => {
    const { result } = renderHook(() => useSigningRequest(), {
        wrapper: HookWrapper,
    })
    act(() => {
        for (const request of result.current.pendingSignRequests) {
            result.current.removeSignRequest(request)
        }
    })
}

const enableQuantumFlag = async (): Promise<void> => {
    await useRemoteConfigStore.persist.rehydrate()
    useRemoteConfigStore.getState().setConfigOverride(QUANTUM_FLAG, true)
}

/**
 * The provider next to the review sheet, as `RootComponent` mounts them. The
 * once-per-device request FAQ and the quantum dApp warning are both
 * pre-acknowledged so neither can open a competing sheet: this file exercises
 * the fee override, not the warning.
 */
const ConnectionsWithSigning = () => {
    const { setPreference } = usePreferences()
    const acknowledged = useRef(false)
    useEffect(() => {
        if (acknowledged.current) return
        acknowledged.current = true
        setPreference('hasSeenTransactionRequestFAQ', true)
        setPreference(UserPreferences.quantumDappWarningAcknowledged, true)
    }, [setPreference])

    return (
        <ConnectionsProvider>
            <RegistryProbe />
            <SigningOverlays />
        </ConnectionsProvider>
    )
}

const mountProviderWithSigning = async () => {
    renderWithNavigation(ConnectionsWithSigning, 'ConnectionsWithSigning')
    await waitFor(() => {
        expect(captured.registry).toBeTruthy()
    })
}

const fireSessionRequest = (
    connector: NonNullable<ReturnType<typeof walletConnectClientStub.last>>,
) => {
    act(() => {
        connector.fire('session_request', null, {
            id: 42,
            params: [
                {
                    peerMeta: {
                        name: 'Quantum-fee dApp',
                        description: '',
                        url: 'https://quantum.example',
                        icons: [],
                    },
                    chainId: AlgorandChainId.mainnet,
                    permissions: ['algo_signTxn'],
                },
            ],
        })
    })
}

/** Pairs through the registry and delivers a handshake the way the relay would. */
const pairAndHandshake = async () => {
    await act(async () => {
        await captured.registry!.pair(
            `wc:${Math.random()}@1?bridge=https://relay.example.test&key=ff`,
            { origin: IN_APP_ORIGIN },
        )
    })
    const connector = walletConnectClientStub.last()
    if (!connector) throw new Error('No connector instance captured')
    fireSessionRequest(connector)
    return connector
}

const approveViaUi = async (accountNames: string[]) => {
    await waitFor(() => {
        expect(findButton('common.connect.label')).toBeTruthy()
    })
    for (const name of accountNames) fireEvent.click(rowFor(name))
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

/**
 * Build a 2-transaction atomic group as ARC-0001 wire entries: slot 0 is a
 * payment from `signer` (the wallet signs it), slot 1 is an external party's
 * payment marked `signers: []` (the wallet must not sign it). Returns the wire
 * entries plus the original (pre-adjustment) group id.
 */
const buildGroupEntries = (signer: string) => {
    const tx0 = buildPaymentTransaction({
        sender: signer,
        receiver: HD_TEST_ADDRESS,
        amount: 1_000_000n,
        fee: 1000n,
    })
    const tx1 = buildPaymentTransaction({
        sender: HD_TEST_ADDRESS,
        receiver: signer,
        amount: 500_000n,
        fee: 1000n,
    })
    const [g0, g1] = groupTransactions([tx0, tx1])
    const originalGroup = g0.group ? Uint8Array.from(g0.group) : undefined
    const entries = [
        { txn: encodeToBase64(encodeTransactionRaw(g0)) },
        { txn: encodeToBase64(encodeTransactionRaw(g1)), signers: [] },
    ]
    return { entries, originalGroup }
}

const fireSignRequest = (
    connector: NonNullable<ReturnType<typeof walletConnectClientStub.last>>,
    id: number,
    entries: unknown[],
) => {
    act(() => {
        connector.fire('algo_signTxn', null, {
            id,
            method: 'algo_signTxn',
            params: [entries],
        })
    })
}

const useAlgodMocks = () => {
    server.use(
        // The review sheet looks the peer's url up in the projects API; left
        // unmocked it is a real network round-trip with real latency.
        http.get('*/v1/projects/', () => HttpResponse.json([])),
        // `min-fee: 1000` is what the enqueue reads via getSuggestedParams;
        // the base × PQ multiplier (3) = 3000 µAlgo raised fee.
        mockAlgodTransactionParams({
            response: { fee: 1000, 'min-fee': 1000 },
        }),
        mockAlgodAccountInformation({
            address: QUANTUM_TEST_ADDRESS,
            response: { amount: 5_000_000, 'min-balance': 100_000 },
        }),
        mockAlgodAccountInformation({
            address: REVIEW_SIGNER_ADDRESS,
            response: { amount: 5_000_000, 'min-balance': 100_000 },
        }),
        mockAlgodAccountInformation({
            address: HD_TEST_ADDRESS,
            response: { amount: 5_000_000, 'min-balance': 100_000 },
        }),
        mockAlgodStatus({ response: { 'last-round': 100 } }),
        mockIndexerSearchForAccounts(),
    )
}

describe('Flow: connections quantum fee override end-to-end', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
    })
    afterEach(async () => {
        server.resetHandlers()
        useRemoteConfigStore.getState().resetState()
        useAccountsStore.getState().setAccounts([])
        await getProvider().connections.store.clear()
    })
    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        resetTestKeystore()
        walletConnectClientStub.reset()
        captured.registry = undefined
        drainPendingSignRequests()
        useSettingsStore.getState().resetState()
        useAccountsStore.getState().setAccounts([])
        await getProvider().connections.store.clear()
        // Harness builds mainnet transactions; pin mainnet so the analyzer's
        // genesis-hash check passes regardless of a local .env default.
        useNetworkStore.getState().setNetwork(Networks.mainnet)
        vi.clearAllMocks()
        useAlgodMocks()
    })

    it(
        'Given a quantum signer and a dApp fee below the PQ minimum, when the request is reviewed and confirmed, then the fee is raised to 3000 µAlgo with a regrouped grp, the review shows the Adjusted marker + explainer, and the delivered result carries pqsig bytes at the quantum slot and null at the external slot',
        async () => {
            await enableQuantumFlag()
            const signer = await seedQuantumSender()
            await mountProviderWithSigning()
            const { result: signReq } = renderHook(() => useSigningRequest(), {
                wrapper: HookWrapper,
            })

            const connector = await pairAndHandshake()
            await approveViaUi([signer.name as string])
            await waitForStoredConnection(connector.clientId)

            const { entries, originalGroup } = buildGroupEntries(signer.address)
            const requestId = 7001
            fireSignRequest(connector, requestId, entries)

            // Review sheet opened — the enqueue (which awaits suggested params
            // for the quantum signer) has completed and the pipeline mounted.
            await waitFor(
                () => {
                    expect(screen.getByTestId(SLIDE_TEST_ID)).toBeTruthy()
                },
                { timeout: 15_000 },
            )

            // (i18n returns keys as-is in the integration environment.)
            expect(await screen.findByText(ADJUSTED_LABEL_KEY)).toBeTruthy()
            expect(
                await screen.findByTestId(QUANTUM_FEE_EXPLAINER_TEST_ID),
            ).toBeTruthy()

            // Enqueue-level truth: the raised fee + recomputed grp live on the
            // request the pipeline signs (the quantum slot's own bytes are a
            // pqsig carrier, so the fee/grp are asserted on this decodable
            // representation).
            const enqueued = signReq.current
                .pendingSignRequests[0] as TransactionSignRequest
            expect(enqueued).toBeTruthy()
            expect(enqueued.feeAdjustments).toHaveLength(1)
            expect(enqueued.feeAdjustments![0].originalFee).toBe(1000n)
            expect(enqueued.feeAdjustments![0].adjustedFee).toBe(
                EXPECTED_PQ_FEE,
            )

            const group = enqueued.groupContext as PeraTransaction[]
            expect(group[0].fee).toBe(EXPECTED_PQ_FEE)
            // Regrouped over the ENTIRE group: both slots carry the SAME new grp
            // (consistent recompute) and it differs from the incoming grp.
            expect(group[0].group).toBeTruthy()
            expect(group[1].group).toBeTruthy()
            expect(bytesEqual(group[0].group!, group[1].group!)).toBe(true)
            expect(originalGroup).toBeTruthy()
            expect(bytesEqual(group[0].group!, originalGroup!)).toBe(false)

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
            expect(result).toHaveLength(2)
            // External party's slot is padded null (the wallet did not sign it).
            expect(result[1]).toBeNull()
            // Quantum slot carries the pqsig carrier: present and far larger
            // than an ed25519-signed payment (~250B) — a Falcon-1024 signature
            // pushes the carrier well past 1KB.
            expect(result[0]).toBeTruthy()
            const pqsigBytes = decodeFromBase64(result[0] as string)
            expect(pqsigBytes.length).toBeGreaterThan(1000)

            expect(connector.rejectRequestCalls).toHaveLength(0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a non-quantum (algo25) signer, when the same 2-txn group is signed over the connection, then no fee is adjusted, no Adjusted marker is shown, only the external slot wears the Other signer pill, and the delivered transaction is byte-identical to the request',
        async () => {
            await enableQuantumFlag()
            const account = await seedAlgo25Signer()
            await mountProviderWithSigning()
            const { result: signReq } = renderHook(() => useSigningRequest(), {
                wrapper: HookWrapper,
            })

            const connector = await pairAndHandshake()
            await approveViaUi([account.name as string])
            await waitForStoredConnection(connector.clientId)

            const { entries } = buildGroupEntries(account.address)
            const requestId = 7002
            fireSignRequest(connector, requestId, entries)

            await waitFor(
                () => {
                    expect(screen.getByTestId(SLIDE_TEST_ID)).toBeTruthy()
                },
                { timeout: 15_000 },
            )

            // No quantum signer ⇒ no fee override marker on the review surface.
            expect(screen.queryByText(ADJUSTED_LABEL_KEY)).toBeNull()
            // Only slot 1 (`signers: []`) is external; the wallet's own slot
            // must not wear the pill.
            expect(screen.getAllByText(EXTERNAL_PILL_KEY)).toHaveLength(1)

            // Enqueue fast-path: no adjustments, and the signable slot's wire
            // bytes are passed through verbatim (byte-identical to the dApp's).
            const enqueued = signReq.current
                .pendingSignRequests[0] as TransactionSignRequest
            expect(enqueued).toBeTruthy()
            expect(enqueued.feeAdjustments).toBeUndefined()
            expect(enqueued.rawTransactionsBase64![0]).toBe(entries[0].txn)

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
            expect(result).toHaveLength(2)
            expect(result[1]).toBeNull()
            expect(result[0]).toBeTruthy()

            // The signed response's embedded transaction is byte-for-byte the
            // request transaction (the signature differs, the txn must not).
            const signed = decodeSignedTransaction(
                decodeFromBase64(result[0] as string),
            )
            const deliveredTxn = encodeToBase64(
                encodeTransactionRaw(signed.txn),
            )
            expect(rawTransactionsMatch([entries[0].txn], [deliveredTxn])).toBe(
                true,
            )

            expect(connector.rejectRequestCalls).toHaveLength(0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a quantum signer whose dApp warning is unacknowledged, when a sign request is opened and confirmed, then the warning sheet appears before signing',
        async () => {
            await enableQuantumFlag()
            const signer = await seedQuantumSender()
            await mountProviderWithSigning()

            const connector = await pairAndHandshake()
            await approveViaUi([signer.name as string])
            await waitForStoredConnection(connector.clientId)

            // Approving through the sheet with a quantum account already
            // passes the connect-time gate, so the acknowledgement is dropped
            // here: the sign-time backstop must catch a session whose
            // acknowledgement is gone (a restored session on a fresh install).
            act(() => {
                useSettingsStore
                    .getState()
                    .deletePreference(
                        UserPreferences.quantumDappWarningAcknowledged,
                    )
            })

            const { entries } = buildGroupEntries(signer.address)
            fireSignRequest(connector, 7003, entries)

            await waitFor(
                () => {
                    expect(screen.getByTestId(SLIDE_TEST_ID)).toBeTruthy()
                },
                { timeout: 15_000 },
            )

            // The backstop runs from handleSignAndSend, so it only fires once
            // the user commits via slide-to-confirm.
            fireEvent.click(screen.getByTestId(SLIDE_TEST_ID))

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId(QUANTUM_DAPP_WARNING_TEST_ID),
                    ).toBeTruthy()
                },
                { timeout: 15_000 },
            )

            // Backstop intercepted before signing — no request has gone out.
            expect(connector.approveRequestCalls).toHaveLength(0)
            expect(connector.rejectRequestCalls).toHaveLength(0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})

// On native the pairing entry point is transient: `useConnectionPairing` is
// reached from the deep-link listener and the QR scanner in whatever screen
// happens to be up, so pairing from one screen and navigating away is the
// ordinary case. `ConnectionsProvider` is what owns the handler for the life
// of the app, and a rekey that lands after the pairing surface went away has
// to reach the live session through it — signer and fee resolution must run
// against the accounts as they are now, not as they were at pairing.
describe('Flow: connections rekey after the pairing surface unmounts', () => {
    const pairingSurface: {
        pair: Optional<ReturnType<typeof useConnectionPairing>['pair']>
        setMounted: Optional<(isMounted: boolean) => void>
    } = { pair: undefined, setMounted: undefined }

    const PairingSurface = () => {
        pairingSurface.pair = useConnectionPairing().pair
        return null
    }

    // The provider stays up; only the surface that called `pair` goes away.
    const ConnectionsWithTransientPairingSurface = () => {
        const [isSurfaceMounted, setIsSurfaceMounted] = useState(true)
        pairingSurface.setMounted = setIsSurfaceMounted
        return (
            <>
                <ConnectionsProvider>
                    <RegistryProbe />
                    {isSurfaceMounted ? <PairingSurface /> : null}
                </ConnectionsProvider>
                <BottomSheetManager />
            </>
        )
    }

    const mountProviderWithTransientSurface = async () => {
        render(<ConnectionsWithTransientPairingSurface />)
        await waitFor(() => {
            expect(captured.registry).toBeTruthy()
            expect(pairingSurface.pair).toBeTruthy()
        })
    }

    /**
     * Pairs through the surface's own `pair` (the hook every real entry point
     * uses), answers the handshake, approves for `accountNames` through the
     * sheet, then unmounts the surface. Returns the live connector.
     */
    const pairApproveThenUnmountSurface = async (accountNames: string[]) => {
        let pairing: Promise<ConnectionPairingResult> | undefined
        act(() => {
            pairing = pairingSurface.pair!(
                `wc:${Math.random()}@1?bridge=https://relay.example.test&key=ff`,
                { origin: IN_APP_ORIGIN },
            )
        })
        await waitFor(() => {
            expect(walletConnectClientStub.last()).toBeTruthy()
        })
        const connector = walletConnectClientStub.last()!
        fireSessionRequest(connector)
        await expect(pairing!).resolves.toEqual({ type: 'session' })

        await approveViaUi(accountNames)
        await waitForStoredConnection(connector.clientId)

        act(() => {
            pairingSurface.setMounted!(false)
        })
        return connector
    }

    /** A landed rekey: `undefined` clears the auth address (the undo direction). */
    const applyRekey = (address: string, rekeyAddress?: string) => {
        act(() => {
            const { accounts, setAccounts } = useAccountsStore.getState()
            setAccounts(
                accounts.map(account =>
                    account.address === address
                        ? { ...account, rekeyAddress }
                        : account,
                ),
            )
        })
    }

    const enqueuedAfter = async (
        signReq: { current: ReturnType<typeof useSigningRequest> },
        baseline: number,
    ): Promise<TransactionSignRequest> => {
        await waitFor(
            () => {
                expect(signReq.current.pendingSignRequests).toHaveLength(
                    baseline + 1,
                )
            },
            { timeout: 10_000 },
        )
        return signReq.current.pendingSignRequests.at(
            -1,
        ) as TransactionSignRequest
    }

    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
    })
    afterEach(async () => {
        server.resetHandlers()
        useRemoteConfigStore.getState().resetState()
        useAccountsStore.getState().setAccounts([])
        await getProvider().connections.store.clear()
    })
    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        resetTestKeystore()
        walletConnectClientStub.reset()
        captured.registry = undefined
        pairingSurface.pair = undefined
        pairingSurface.setMounted = undefined
        drainPendingSignRequests()
        useSettingsStore.getState().resetState()
        useSettingsStore
            .getState()
            .setPreference(UserPreferences.quantumDappWarningAcknowledged, true)
        useAccountsStore.getState().setAccounts([])
        await getProvider().connections.store.clear()
        useNetworkStore.getState().setNetwork(Networks.mainnet)
        vi.clearAllMocks()
        useAlgodMocks()
    })

    it(
        'Given a session paired from a surface that has since unmounted, when a rekey pointing the sender at a held quantum auth address lands and the dApp then requests a signature, then the request is signable and its fee is raised to the post-quantum minimum',
        async () => {
            await enableQuantumFlag()
            const sender = await seedAlgo25Signer()
            const quantumAuth = await seedQuantumSigner()
            await mountProviderWithTransientSurface()
            const { result: signReq } = renderHook(() => useSigningRequest(), {
                wrapper: HookWrapper,
            })

            const connector = await pairApproveThenUnmountSurface([
                sender.name as string,
                quantumAuth.name as string,
            ])

            applyRekey(sender.address, quantumAuth.address)

            const { entries } = buildGroupEntries(sender.address)
            // The signing store is a module singleton with no per-test
            // reset, so count from the pre-request baseline, not zero.
            const baseline = signReq.current.pendingSignRequests.length
            fireSignRequest(connector, 7101, entries)

            const enqueued = await enqueuedAfter(signReq, baseline)
            expect(enqueued.feeAdjustments).toHaveLength(1)
            expect(enqueued.feeAdjustments![0].adjustedFee).toBe(
                EXPECTED_PQ_FEE,
            )
            expect((enqueued.groupContext as PeraTransaction[])[0].fee).toBe(
                EXPECTED_PQ_FEE,
            )
            expect(connector.rejectRequestCalls).toHaveLength(0)

            act(() => {
                signReq.current.removeSignRequest(enqueued)
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        "Given a session paired from a surface that has since unmounted, when a rekey to a held quantum auth address is undone back to the sender's own standard key, then the still-signable request's fee drops from the post-quantum minimum back to the ordinary minimum",
        async () => {
            await enableQuantumFlag()
            const sender = await seedAlgo25Signer()
            const quantumAuth = await seedQuantumSigner()
            // Rekeyed to a HELD quantum auth address from the start: signable
            // throughout, so the fee is the only thing the undo changes.
            applyRekey(sender.address, quantumAuth.address)
            await mountProviderWithTransientSurface()
            const { result: signReq } = renderHook(() => useSigningRequest(), {
                wrapper: HookWrapper,
            })

            const connector = await pairApproveThenUnmountSurface([
                sender.name as string,
                quantumAuth.name as string,
            ])

            applyRekey(sender.address, undefined)

            const { entries } = buildGroupEntries(sender.address)
            const baseline = signReq.current.pendingSignRequests.length
            fireSignRequest(connector, 7102, entries)

            const enqueued = await enqueuedAfter(signReq, baseline)
            expect(enqueued.feeAdjustments).toBeUndefined()
            expect((enqueued.groupContext as PeraTransaction[])[0].fee).toBe(
                1000n,
            )
            expect(connector.rejectRequestCalls).toHaveLength(0)

            act(() => {
                signReq.current.removeSignRequest(enqueued)
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
