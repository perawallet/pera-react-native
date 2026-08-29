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

// The quantum fee override across the whole WalletConnect -> ARC-0001 enqueue
// -> review -> sign -> callback-delivery loop. `wc-sign.test.tsx` stops at the
// rejection boundary and `sign-review-quantum-fee.test.tsx` mounts only the
// review surface, so this is the one that drives a real `algo_signTxn` through
// the connector stub end to end.
//
// Scenario (a) is the quantum path (fee raised to the PQ minimum, regrouped,
// "Adjusted" marker shown); scenario (b) proves an algo25 request stays
// byte-identical, so the override never touches ordinary dApp traffic.

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
import React, { useEffect, useRef } from 'react'
import {
    act,
    fireEvent,
    renderHook,
    screen,
    waitFor,
} from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'

import { createTestQueryClient } from '@test-utils/render'
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
} from '@perawallet/wallet-core-shared'
import {
    useSigningRequest,
    type TransactionSignRequest,
} from '@perawallet/wallet-core-signing'
import {
    AlgorandChainId,
    useWalletConnect,
    useWalletConnectStore,
    type WalletConnectSessionRequest,
} from '@perawallet/wallet-core-walletconnect'
import { SigningOverlays } from '@modules/signing/components/SigningOverlays'
import { QUANTUM_FEE_EXPLAINER_TEST_ID } from '@modules/transactions/components/QuantumFeeExplainer'
import { UserPreferences } from '@constants/user-preferences'

import { HD_TEST_ADDRESS } from './__fixtures__/onboarding'
import {
    QUANTUM_TEST_ADDRESS,
    QUANTUM_TEST_MNEMONIC,
} from './__fixtures__/quantum'

const SLOW_TEST_TIMEOUT_MS = 30_000
const QUANTUM_FLAG = 'enable_quantum_accounts'
const ADJUSTED_LABEL_KEY = 'transactions.quantum_fee.adjusted_label'
const SLIDE_TEST_ID = 'signing-confirm-slide'
const QUANTUM_DAPP_WARNING_TEST_ID = 'quantum-dapp-warning-sheet'

// The base 1000 µAlgo minimum × the fallback PQ multiplier (3) — what the
// override raises a quantum signer's fee to given `min-fee: 1000` from algod
// and the default remote config.
const EXPECTED_PQ_FEE = 3000n

// `useWalletConnect` mounts the signing pipeline (React-Query backed adapters),
// so the pairing hook needs its own QueryClientProvider — the review surface is
// rendered in a separate tree via `renderWithNavigation`. Both share the global
// Zustand signing/accounts stores, which is how a request enqueued from the WC
// tree surfaces in the review tree.
const hookQueryClient = createTestQueryClient()
const HookWrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={hookQueryClient}>
        {children}
    </QueryClientProvider>
)

/**
 * Mint a REAL quantum (Falcon-mock) key from the pinned quantum mnemonic and
 * register the derived quantum account so the signing machine can produce a
 * genuine pqsig carrier. Mirrors `send-from-quantum.test.tsx`'s seeder.
 */
const seedQuantumSender = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let keyResult: QuantumKeyResult | null = null
    await waitFor(async () => {
        keyResult = await kms.current.createQuantumKey({
            mnemonic: QUANTUM_TEST_MNEMONIC,
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

const enableQuantumFlag = async (): Promise<void> => {
    await useRemoteConfigStore.persist.rehydrate()
    useRemoteConfigStore.getState().setConfigOverride(QUANTUM_FLAG, true)
}

/**
 * Mounts the interactive review surface (SigningOverlays) inside the test
 * navigator so a request enqueued into the signing store opens the review
 * sheet. Suppresses the once-per-device transaction-request FAQ so it can't
 * open a competing bottom sheet.
 */
const ReviewSurface = () => {
    const { setPreference } = usePreferences()
    const ready = useRef(false)
    useEffect(() => {
        if (ready.current) return
        ready.current = true
        setPreference('hasSeenTransactionRequestFAQ', true)
        // This file exercises the fee override, not the dApp
        // warning, so it runs as a returning user who already acknowledged it.
        setPreference(UserPreferences.quantumDappWarningAcknowledged, true)
    }, [setPreference])
    return <SigningOverlays />
}

/**
 * Same as `ReviewSurface`, but leaves the quantum dApp warning unacknowledged
 * — a first-time user, for the backstop coverage below.
 */
const ReviewSurfaceFirstTimeQuantumWarning = () => {
    const { setPreference } = usePreferences()
    const ready = useRef(false)
    useEffect(() => {
        if (ready.current) return
        ready.current = true
        setPreference('hasSeenTransactionRequestFAQ', true)
    }, [setPreference])
    return <SigningOverlays />
}

/**
 * Pair + approve a WalletConnect session over the connector stub for the given
 * accounts, leaving a live connected connector ready for `algo_signTxn`.
 * Follows `wc-sign.test.tsx`'s `pairAndApprove`, parameterised on accounts.
 *
 * Returns the pairing host's `unmount` too: a real pairing surface is
 * transient (every screen layout reaches `useWalletConnectPairing`), so a
 * test that needs the session to outlive the surface that created it has to
 * be able to tear that surface down.
 */
const pairAndApproveWithHost = async (accounts: string[]) => {
    const { result: wc, unmount } = renderHook(
        () => useWalletConnect(Networks.mainnet),
        {
            wrapper: HookWrapper,
        },
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
            name: 'Quantum-fee dApp',
            description: '',
            url: 'https://quantum.example',
            icons: [],
        },
        chainId: AlgorandChainId.mainnet,
        permissions: ['algo_signTxn'],
        clientId: connector.clientId,
    }
    act(() => {
        connector.fire('session_request', null, { params: [sessionPayload] })
    })
    await waitFor(() => {
        expect(useWalletConnectStore.getState().sessionRequests).toHaveLength(1)
    })

    await act(async () => {
        await wc.current.approveSession(
            connector.clientId,
            sessionPayload,
            accounts,
        )
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

    return { connector, unmount }
}

const pairAndApprove = async (accounts: string[]) =>
    (await pairAndApproveWithHost(accounts)).connector

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
    connector: ReturnType<typeof walletConnectClientStub.last> & object,
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

describe('Flow: WalletConnect quantum fee override end-to-end', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
    })
    afterEach(() => {
        server.resetHandlers()
        useRemoteConfigStore.getState().resetState()
        useWalletConnectStore.getState().setSessionRequests([])
        useWalletConnectStore.getState().setWalletConnectConnections([])
        useWalletConnectStore.getState().setConnectionError(null)
        useAccountsStore.getState().setAccounts([])
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
        useSettingsStore.getState().resetState()
        useAccountsStore.getState().setAccounts([])
        useWalletConnectStore.getState().setSessionRequests([])
        useWalletConnectStore.getState().setWalletConnectConnections([])
        useWalletConnectStore.getState().setConnectionError(null)
        // Harness builds mainnet transactions; pin mainnet so the analyzer's
        // genesis-hash check passes regardless of a local .env default.
        useNetworkStore.getState().setNetwork('mainnet')
        vi.clearAllMocks()
        server.use(
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
    })

    it(
        'Given a quantum signer and a dApp fee below the PQ minimum, when the WC request is reviewed and confirmed, then the fee is raised to 3000 µAlgo with a regrouped grp, the review shows the Adjusted marker + explainer, and the approve result carries pqsig bytes at the quantum slot and null at the external slot',
        async () => {
            await enableQuantumFlag()
            const signer = await seedQuantumSender()

            renderWithNavigation(ReviewSurface, 'ReviewSurface')
            const { result: signReq } = renderHook(() => useSigningRequest(), {
                wrapper: HookWrapper,
            })

            const { entries, originalGroup } = buildGroupEntries(signer.address)
            const requestId = 7001

            const connector = await pairAndApprove([signer.address])
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
            // representation per the task brief).
            const enqueued = signReq.current
                .pendingSignRequests[0] as TransactionSignRequest
            expect(enqueued).toBeTruthy()
            expect(enqueued.feeAdjustments).toBeTruthy()
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

            const result = connector.approveRequestCalls[0].result as (
                | string
                | null
            )[]
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

            // No error surfaced anywhere in the loop.
            expect(connector.rejectRequestCalls).toHaveLength(0)
            expect(useWalletConnectStore.getState().connectionError).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a non-quantum (algo25) signer, when the same 2-txn group is signed over WC, then no fee is adjusted, no Adjusted marker is shown, and the delivered transaction is byte-identical to the request',
        async () => {
            await enableQuantumFlag()
            const account = await seedAlgo25Signer()

            renderWithNavigation(ReviewSurface, 'ReviewSurface')
            const { result: signReq } = renderHook(() => useSigningRequest(), {
                wrapper: HookWrapper,
            })

            const { entries } = buildGroupEntries(account.address)
            const requestId = 7002

            const connector = await pairAndApprove([account.address])
            fireSignRequest(connector, requestId, entries)

            await waitFor(
                () => {
                    expect(screen.getByTestId(SLIDE_TEST_ID)).toBeTruthy()
                },
                { timeout: 15_000 },
            )

            // No quantum signer ⇒ no fee override marker on the review surface.
            expect(screen.queryByText(ADJUSTED_LABEL_KEY)).toBeNull()

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

            const result = connector.approveRequestCalls[0].result as (
                | string
                | null
            )[]
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
            expect(useWalletConnectStore.getState().connectionError).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a quantum signer whose dApp warning is unacknowledged, when a WC sign request is opened, then the warning sheet appears before signing',
        async () => {
            await enableQuantumFlag()
            const signer = await seedQuantumSender()

            renderWithNavigation(
                ReviewSurfaceFirstTimeQuantumWarning,
                'ReviewSurfaceFirstTimeQuantumWarning',
            )
            renderHook(() => useSigningRequest(), { wrapper: HookWrapper })

            const { entries } = buildGroupEntries(signer.address)
            const connector = await pairAndApprove([signer.address])
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

// A WalletConnect v1 connector's event listeners live outside React and read
// their handlers through refs that `useWalletConnect` reassigns during render.
// When the instance that bound the connector unmounts, those refs freeze — and
// with them every value the handler chain captured at render, including the
// accounts array signer/fee resolution runs against. A rekey that lands after
// a transient pairing surface went away then never reaches the live session.
//
// The pairing surface really is transient on native: `connect` comes from
// `useWalletConnectPairing`, reached from `useDeeplinkListener()` in every
// screen layout — so pairing from one screen and navigating away is the
// ordinary case, not an edge case.
describe('Flow: WalletConnect rekey after the pairing surface unmounts', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
    })
    afterEach(() => {
        server.resetHandlers()
        useRemoteConfigStore.getState().resetState()
        useWalletConnectStore.getState().setSessionRequests([])
        useWalletConnectStore.getState().setWalletConnectConnections([])
        useWalletConnectStore.getState().setConnectionError(null)
        useAccountsStore.getState().setAccounts([])
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
        useSettingsStore.getState().resetState()
        useAccountsStore.getState().setAccounts([])
        useWalletConnectStore.getState().setSessionRequests([])
        useWalletConnectStore.getState().setWalletConnectConnections([])
        useWalletConnectStore.getState().setConnectionError(null)
        useNetworkStore.getState().setNetwork('mainnet')
        vi.clearAllMocks()
        server.use(
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
    })

    /**
     * The app's single long-lived owner of WC request handlers, standing in
     * for `useWalletConnectProvider` (mounted once from `RootComponent`)
     * without dragging its bottom sheets and navigation into the harness.
     * Stays mounted for the whole test, exactly as the provider does.
     */
    const mountHandlerOwner = () =>
        renderHook(
            () =>
                useWalletConnect(Networks.mainnet, {
                    ownsRequestHandlers: true,
                }),
            { wrapper: HookWrapper },
        )

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

    it(
        'Given a session paired from a surface that has since unmounted, when a rekey pointing the sender at a held quantum auth address lands and the dApp then requests a signature, then the request is signable and its fee is raised to the post-quantum minimum',
        async () => {
            await enableQuantumFlag()
            const sender = await seedAlgo25Signer()
            const quantumAuth = await seedQuantumSigner()
            // Starts rekeyed to an auth address the wallet doesn't hold, so
            // the sender has no reachable signer until the rekey below lands.
            applyRekey(sender.address, HD_TEST_ADDRESS)

            mountHandlerOwner()
            const { result: signReq } = renderHook(() => useSigningRequest(), {
                wrapper: HookWrapper,
            })

            const { connector, unmount } = await pairAndApproveWithHost([
                sender.address,
                quantumAuth.address,
            ])
            unmount()

            applyRekey(sender.address, quantumAuth.address)

            const { entries } = buildGroupEntries(sender.address)
            // The signing store is a module singleton with no per-test
            // reset, so count from the pre-request baseline, not zero.
            const enqueuedBefore = signReq.current.pendingSignRequests.length
            fireSignRequest(connector, 7101, entries)

            await waitFor(
                () => {
                    expect(signReq.current.pendingSignRequests).toHaveLength(
                        enqueuedBefore + 1,
                    )
                },
                { timeout: 10_000 },
            )

            const enqueued = signReq.current.pendingSignRequests.at(
                -1,
            ) as TransactionSignRequest
            expect(enqueued.feeAdjustments).toHaveLength(1)
            expect(enqueued.feeAdjustments![0].adjustedFee).toBe(
                EXPECTED_PQ_FEE,
            )
            expect((enqueued.groupContext as PeraTransaction[])[0].fee).toBe(
                EXPECTED_PQ_FEE,
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        "Given a session paired from a surface that has since unmounted, when the rekey is undone back to the account's own standard key and the dApp then requests a signature, then the request is signable and keeps the ordinary minimum fee",
        async () => {
            await enableQuantumFlag()
            const sender = await seedAlgo25Signer()
            const quantumAuth = await seedQuantumSigner()
            applyRekey(sender.address, HD_TEST_ADDRESS)

            mountHandlerOwner()
            const { result: signReq } = renderHook(() => useSigningRequest(), {
                wrapper: HookWrapper,
            })

            const { connector, unmount } = await pairAndApproveWithHost([
                sender.address,
                quantumAuth.address,
            ])
            unmount()

            applyRekey(sender.address, undefined)

            const { entries } = buildGroupEntries(sender.address)
            const enqueuedBefore = signReq.current.pendingSignRequests.length
            fireSignRequest(connector, 7102, entries)

            await waitFor(
                () => {
                    expect(signReq.current.pendingSignRequests).toHaveLength(
                        enqueuedBefore + 1,
                    )
                },
                { timeout: 10_000 },
            )

            const enqueued = signReq.current.pendingSignRequests.at(
                -1,
            ) as TransactionSignRequest
            expect(enqueued.feeAdjustments).toBeUndefined()
            expect((enqueued.groupContext as PeraTransaction[])[0].fee).toBe(
                1000n,
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    // Both tests above start the sender rekeyed to an address the wallet
    // does NOT hold, so the discriminating condition they exercise is
    // signability, not the fee transition's own repro shows: an
    // already-signable sender whose fee moves 3000n -> 1000n when a rekey to
    // a held quantum auth account is undone. This test covers that
    // transition directly.
    //
    // Two independent mechanisms now protect this fee (the live accounts-
    // store read in useMinimumFeeCalculator, and the handler-ownership fix
    // that keeps stale refs from serving a frozen rekey state) — so this
    // test stays green if only one of them regresses. It guards the
    // ticket's acceptance criterion, not either mechanism individually.
    it(
        "Given a session paired from a surface that has since unmounted, when a rekey to a held quantum auth address is undone back to the sender's own standard key, then the still-signable request's fee drops from the post-quantum minimum back to the ordinary minimum",
        async () => {
            await enableQuantumFlag()
            const sender = await seedAlgo25Signer()
            const quantumAuth = await seedQuantumSigner()
            // Rekeyed to a HELD quantum auth address: signable throughout,
            // unlike the two tests above.
            applyRekey(sender.address, quantumAuth.address)

            mountHandlerOwner()
            const { result: signReq } = renderHook(() => useSigningRequest(), {
                wrapper: HookWrapper,
            })

            const { connector, unmount } = await pairAndApproveWithHost([
                sender.address,
                quantumAuth.address,
            ])
            unmount()

            applyRekey(sender.address, undefined)

            const { entries } = buildGroupEntries(sender.address)
            const enqueuedBefore = signReq.current.pendingSignRequests.length
            fireSignRequest(connector, 7103, entries)

            await waitFor(
                () => {
                    expect(signReq.current.pendingSignRequests).toHaveLength(
                        enqueuedBefore + 1,
                    )
                },
                { timeout: 10_000 },
            )

            const enqueued = signReq.current.pendingSignRequests.at(
                -1,
            ) as TransactionSignRequest
            expect(enqueued.feeAdjustments).toBeUndefined()
            expect((enqueued.groupContext as PeraTransaction[])[0].fee).toBe(
                1000n,
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
