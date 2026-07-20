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

// PQ-019 / PERA-4643: the quantum submission gate in `submitAndAutoRefresh`
// decides — per node — whether a Falcon-signed group may be broadcast for real.
// A quantum group is POSTed to algod only when the connected node's genesis
// hash (probed via `GET /versions`) is NOT a known production hash (LocalNet /
// custom net ⇒ capable); against a mainnet/testnet node the gate throws
// `QuantumBroadcastUnsupportedError` and nothing is broadcast.
//
// These two tests drive a real quantum payment through the signing state
// machine over the ALGOD transport (the path that reaches
// `submitAndAutoRefresh`) and assert both sides of that gate: a capable node
// broadcasts for real; a production node fails loudly with no broadcast.

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
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Notifier } from 'react-native-notifier'

import { server } from '@test-utils/msw-server'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useKMS, type QuantumKeyResult } from '@perawallet/wallet-core-kms'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import { config } from '@perawallet/wallet-core-config'
import {
    mockAlgodAccountInformation,
    mockAlgodStatus,
    mockAlgodTransactionParams,
    mockAlgodVersions,
    mockIndexerSearchForAccounts,
} from '@perawallet/wallet-core-blockchain/test-handlers'

import {
    buildPaymentTransaction,
    buildTransactionSignRequest,
    renderSignReview,
} from '@test-utils/signing-review'

import { HD_TEST_ADDRESS } from './__fixtures__/onboarding'
import {
    QUANTUM_TEST_ADDRESS,
    QUANTUM_TEST_MNEMONIC,
} from './__fixtures__/quantum'

const RECEIVER_ADDRESS = HD_TEST_ADDRESS

const SLOW_TEST_TIMEOUT_MS = 30_000

const QUANTUM_FLAG_KEY = 'enable_quantum_accounts'

// A valid base64 32-byte genesis hash that is NOT the mainnet/testnet hash, so
// the capability probe reports the node as quantum-capable. Distinct from the
// production hash used in Case B, so the module-level per-genesis-hash memo in
// `supportsQuantumBroadcast` never conflates the two cases.
const CAPABLE_GENESIS_HASH_B64 = Buffer.from(
    new Uint8Array(32).fill(7),
).toString('base64')

const enableQuantumFlag = async (): Promise<void> => {
    await useRemoteConfigStore.persist.rehydrate()
    useRemoteConfigStore.getState().setConfigOverride(QUANTUM_FLAG_KEY, true)
}

// Mint a REAL quantum (Falcon-mock) key in the in-memory keystore from the
// pinned quantum mnemonic and register the matching account in the accounts
// store. `keyPairId` is the derived signing CHILD id (`signKeyId`).
const seedQuantumSender = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let keyResult: QuantumKeyResult | null = null
    await waitFor(async () => {
        keyResult = await kms.current.createQuantumKey({
            mnemonic: QUANTUM_TEST_MNEMONIC,
        })
        expect(keyResult).not.toBeNull()
    })

    const sender: WalletAccount = {
        id: 'quantum-sender-1',
        type: AccountTypes.quantum,
        address: QUANTUM_TEST_ADDRESS,
        keyPairId: keyResult!.signKeyId,
        name: 'Quantum sender',
    }
    useAccountsStore.getState().setAccounts([sender])
    useAccountsStore.getState().setSelectedAccountAddress(sender.address)
    return sender
}

describe('submit from quantum account over algod transport (PQ-019)', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
    })
    afterEach(() => {
        server.resetHandlers()
        useRemoteConfigStore.getState().resetState()
    })
    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        useNetworkStore.getState().setNetwork('mainnet')
        await seedAlgoAsset('mainnet')

        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useRemoteConfigStore.getState().resetState()
        vi.mocked(Notifier.showNotification).mockClear()

        server.use(
            mockAlgodTransactionParams({ response: { fee: 1000 } }),
            mockAlgodAccountInformation({
                address: QUANTUM_TEST_ADDRESS,
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
            mockAlgodAccountInformation({
                address: RECEIVER_ADDRESS,
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
            mockAlgodStatus({ response: { 'last-round': 100 } }),
            mockIndexerSearchForAccounts(),
        )
    })

    it(
        'Given a quantum-capable node, when a quantum payment is signed over the algod transport, then the Falcon group is broadcast for real and the gate does not fire',
        async () => {
            await enableQuantumFlag()
            await seedQuantumSender()

            const payment = buildPaymentTransaction({
                sender: QUANTUM_TEST_ADDRESS,
                receiver: RECEIVER_ADDRESS,
                amount: 1_000_000n,
                fee: 1000n,
            })
            const { request, error: errorSpy } = buildTransactionSignRequest({
                sourceType: 'local',
                txs: [payment],
                overrides: { transport: 'algod' },
            })

            // The node's genesis hash is NOT a production hash → capable → the
            // Falcon group is broadcast for real via `sendRawTransaction`.
            server.use(
                mockAlgodVersions({ genesisHashB64: CAPABLE_GENESIS_HASH_B64 }),
            )

            const sendSpy = vi.fn(() =>
                HttpResponse.json(
                    {
                        txId: 'REALQUANTUMTXID000000000000000000000000000000000000',
                    },
                    { status: 200 },
                ),
            )
            server.use(http.post('*/v2/transactions', sendSpy))

            renderSignReview(request)

            // The real broadcast is the load-bearing assertion: a POST to
            // algod's send-raw-transaction endpoint means the gate resolved
            // this node as quantum-capable and handed off the Falcon group.
            await waitFor(
                () => {
                    expect(sendSpy).toHaveBeenCalled()
                },
                { timeout: 15_000 },
            )

            // The capability gate must NOT have surfaced its unsupported error.
            const surfacedUnsupported = errorSpy.mock.calls.some(call =>
                /does not support quantum/i.test(
                    String((call[0] as Error | undefined)?.message),
                ),
            )
            expect(surfacedUnsupported).toBe(false)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a production (mainnet) node, when a quantum payment is signed over the algod transport, then the gate throws QuantumBroadcastUnsupportedError and nothing is broadcast',
        async () => {
            await enableQuantumFlag()
            await seedQuantumSender()

            const payment = buildPaymentTransaction({
                sender: QUANTUM_TEST_ADDRESS,
                receiver: RECEIVER_ADDRESS,
                amount: 1_000_000n,
                fee: 1000n,
            })
            const { request, error: errorSpy } = buildTransactionSignRequest({
                sourceType: 'local',
                txs: [payment],
                overrides: { transport: 'algod' },
            })

            // The node reports the mainnet genesis hash → NOT capable → the gate
            // throws before any broadcast.
            server.use(
                mockAlgodVersions({
                    genesisHashB64: config.mainnetGenesisHash,
                }),
            )

            // Any broadcast is a failure: a Falcon group must never reach a
            // node that cannot verify it.
            const sendSpy = vi.fn(() =>
                HttpResponse.json(
                    {
                        txId: 'SHOULDNOTBEHIT00000000000000000000000000000000000000',
                    },
                    { status: 200 },
                ),
            )
            server.use(http.post('*/v2/transactions', sendSpy))

            renderSignReview(request)

            await waitFor(
                () => {
                    expect(errorSpy).toHaveBeenCalled()
                },
                { timeout: 15_000 },
            )

            // The algod transport wraps the gate error, so match the
            // gate-specific message rather than the concrete class.
            const gateError = errorSpy.mock.calls[0]?.[0] as Error
            expect(String(gateError?.message)).toMatch(
                /does not support quantum/i,
            )

            // No node ever saw the Falcon-signed group.
            expect(sendSpy).not.toHaveBeenCalled()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
