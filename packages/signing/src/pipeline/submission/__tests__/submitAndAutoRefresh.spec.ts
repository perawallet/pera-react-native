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

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    submitAndAutoRefresh,
    submitAndAutoRefreshCore,
} from '../submitAndAutoRefresh'
import { setOnConfirmedHandler } from '../onConfirmedRegistry'
import { QuantumBroadcastUnsupportedError } from '../../errors'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    useNetworkStore,
    type PeraSignedTransaction,
} from '@perawallet/wallet-core-blockchain'

const {
    mockWaitForConfirmation,
    mockSupportsQuantumBroadcast,
    mockConfigState,
} = vi.hoisted(() => ({
    mockWaitForConfirmation: vi.fn(),
    mockSupportsQuantumBroadcast: vi.fn(),
    mockConfigState: { quantumMockSubmit: false },
}))

vi.mock('algosdk', async importOriginal => ({
    ...(await importOriginal<typeof import('algosdk')>()),
    waitForConfirmation: mockWaitForConfirmation,
}))

// Partial-mock so all real blockchain exports (stores, types) are preserved;
// only the node capability probe is controllable per-test.
vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-blockchain')
    >()),
    supportsQuantumBroadcast: mockSupportsQuantumBroadcast,
}))

// Preserve the real (frozen) config's values (genesis hashes, etc.) but expose
// a mutable getter for the one flag under test so it can be toggled per-test.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            get quantumMockSubmit() {
                return mockConfigState.quantumMockSubmit
            },
        },
    }
})

const WALLET = 'WALLET_A'
const EXTERNAL = 'EXTERNAL'

const addr = (s: string) => ({ toString: () => s })

const makeSigned = (sender: string, receiver?: string): PeraSignedTransaction =>
    ({
        txn: {
            sender: addr(sender),
            ...(receiver
                ? { payment: { receiver: addr(receiver), amount: 0n } }
                : {}),
        },
        sig: new Uint8Array(),
    }) as unknown as PeraSignedTransaction

const flushMicrotasks = async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
}

describe('submitAndAutoRefreshCore', () => {
    const makeAlgokit = (txid: Optional<string | string[]> = 'TX1') => ({
        client: {
            algod: {
                sendRawTransaction: vi.fn().mockReturnValue({
                    do: vi.fn().mockResolvedValue({ txid }),
                }),
            },
        },
    })
    const encodeSignedTransactions = vi
        .fn()
        .mockReturnValue([new Uint8Array([1])])

    test('returns txIds from underlying submit immediately, before confirmation resolves', async () => {
        const algokit = makeAlgokit('TX1')
        let resolveConfirmation: () => void = () => {}
        const waitForConfirmation = vi.fn(
            () =>
                new Promise<void>(resolve => {
                    resolveConfirmation = resolve
                }),
        )
        const onConfirmed = vi.fn()

        const result = await submitAndAutoRefreshCore({
            algokit,
            encodeSignedTransactions,
            waitForConfirmation,
            walletAddresses: [WALLET],
            network: 'mainnet',
            onConfirmed,
            signedTxns: [makeSigned(WALLET, EXTERNAL)],
        })

        expect(result).toEqual({ txIds: ['TX1'] })
        expect(onConfirmed).not.toHaveBeenCalled()

        resolveConfirmation()
        await flushMicrotasks()
        expect(onConfirmed).toHaveBeenCalledWith([WALLET], 'mainnet')
    })

    test('on successful confirmation, calls onConfirmed with extracted addresses and network', async () => {
        const algokit = makeAlgokit('TX1')
        const waitForConfirmation = vi.fn().mockResolvedValue(undefined)
        const onConfirmed = vi.fn()

        await submitAndAutoRefreshCore({
            algokit,
            encodeSignedTransactions,
            waitForConfirmation,
            walletAddresses: [WALLET],
            network: 'testnet',
            onConfirmed,
            signedTxns: [makeSigned(WALLET, EXTERNAL)],
        })
        await flushMicrotasks()

        expect(waitForConfirmation).toHaveBeenCalledWith('TX1')
        expect(onConfirmed).toHaveBeenCalledWith([WALLET], 'testnet')
    })

    test('on confirmation rejection, swallows the error and does not call onConfirmed', async () => {
        const algokit = makeAlgokit('TX1')
        const waitForConfirmation = vi
            .fn()
            .mockRejectedValue(new Error('confirmation timeout'))
        const onConfirmed = vi.fn()

        const result = await submitAndAutoRefreshCore({
            algokit,
            encodeSignedTransactions,
            waitForConfirmation,
            walletAddresses: [WALLET],
            network: 'mainnet',
            onConfirmed,
            signedTxns: [makeSigned(WALLET, EXTERNAL)],
        })
        await flushMicrotasks()

        expect(result).toEqual({ txIds: ['TX1'] })
        expect(onConfirmed).not.toHaveBeenCalled()
    })

    test('does not wait for confirmation or call onConfirmed when no txIds are returned', async () => {
        const algokit = {
            client: {
                algod: {
                    sendRawTransaction: vi.fn().mockReturnValue({
                        do: vi.fn().mockResolvedValue({}),
                    }),
                },
            },
        }
        const waitForConfirmation = vi.fn().mockResolvedValue(undefined)
        const onConfirmed = vi.fn()

        // signedTxns without `txn.txId()` so submitSignedTransactionGroup
        // cannot fall back to deriving an id either.
        const signedWithoutTxId = {
            txn: { sender: addr(WALLET) },
            sig: new Uint8Array(),
        } as unknown as PeraSignedTransaction

        const result = await submitAndAutoRefreshCore({
            algokit,
            encodeSignedTransactions,
            waitForConfirmation,
            walletAddresses: [WALLET],
            network: 'mainnet',
            onConfirmed,
            signedTxns: [signedWithoutTxId],
        })
        await flushMicrotasks()

        expect(result.txIds).toEqual([])
        expect(waitForConfirmation).not.toHaveBeenCalled()
        expect(onConfirmed).not.toHaveBeenCalled()
    })

    test('skips onConfirmed when no wallet-held addresses participate', async () => {
        const algokit = makeAlgokit('TX1')
        const waitForConfirmation = vi.fn().mockResolvedValue(undefined)
        const onConfirmed = vi.fn()

        await submitAndAutoRefreshCore({
            algokit,
            encodeSignedTransactions,
            waitForConfirmation,
            walletAddresses: [WALLET],
            network: 'mainnet',
            onConfirmed,
            signedTxns: [makeSigned(EXTERNAL, 'OTHER_EXTERNAL')],
        })
        await flushMicrotasks()

        expect(waitForConfirmation).toHaveBeenCalled()
        expect(onConfirmed).not.toHaveBeenCalled()
    })

    test("quantumMode 'mock': uses a synthetic txid and does not call algod", async () => {
        const algokit = makeAlgokit('TX1')
        const waitForConfirmation = vi.fn().mockResolvedValue(undefined)
        const onConfirmed = vi.fn()

        const { txIds } = await submitAndAutoRefreshCore({
            algokit,
            encodeSignedTransactions: () => [new Uint8Array([1, 2, 3])],
            waitForConfirmation,
            walletAddresses: [WALLET],
            network: 'mainnet',
            onConfirmed,
            signedTxns: [makeSigned(WALLET, EXTERNAL)],
            quantumMode: 'mock',
        })

        expect(txIds[0]).toMatch(/^[A-Z2-7]{52}$/)
        expect(algokit.client.algod.sendRawTransaction).not.toHaveBeenCalled()
        expect(waitForConfirmation).not.toHaveBeenCalled()
        await vi.waitFor(() =>
            expect(onConfirmed).toHaveBeenCalledWith([WALLET], 'mainnet'),
        )
    })

    test("quantumMode 'real': broadcasts the signed bytes via algod and waits for confirmation", async () => {
        const algokit = makeAlgokit('REALQTX')
        const encode = vi.fn().mockReturnValue([new Uint8Array([9, 9, 9])])
        const waitForConfirmation = vi.fn().mockResolvedValue(undefined)
        const onConfirmed = vi.fn()

        const { txIds } = await submitAndAutoRefreshCore({
            algokit,
            encodeSignedTransactions: encode,
            waitForConfirmation,
            walletAddresses: [WALLET],
            network: 'mainnet',
            onConfirmed,
            signedTxns: [makeSigned(WALLET, EXTERNAL)],
            quantumMode: 'real',
        })

        expect(algokit.client.algod.sendRawTransaction).toHaveBeenCalled()
        expect(txIds).toEqual(['REALQTX'])
        await vi.waitFor(() =>
            expect(waitForConfirmation).toHaveBeenCalledWith('REALQTX'),
        )
    })

    test('uses the real path and waits for confirmation when quantumMode is omitted', async () => {
        const algokit = makeAlgokit('REALTXID')
        const waitForConfirmation = vi.fn().mockResolvedValue(undefined)
        const onConfirmed = vi.fn()

        const { txIds } = await submitAndAutoRefreshCore({
            algokit,
            encodeSignedTransactions,
            waitForConfirmation,
            walletAddresses: [WALLET],
            network: 'mainnet',
            onConfirmed,
            signedTxns: [makeSigned(WALLET, EXTERNAL)],
            // quantumMode omitted → 'none'
        })

        expect(algokit.client.algod.sendRawTransaction).toHaveBeenCalled()
        expect(txIds).toEqual(['REALTXID'])
        await vi.waitFor(() =>
            expect(waitForConfirmation).toHaveBeenCalledWith('REALTXID'),
        )
    })

    test('propagates submission errors to the caller', async () => {
        const algokit = {
            client: {
                algod: {
                    sendRawTransaction: vi.fn().mockReturnValue({
                        do: vi
                            .fn()
                            .mockRejectedValue(new Error('algod rejected')),
                    }),
                },
            },
        }
        const waitForConfirmation = vi.fn()
        const onConfirmed = vi.fn()

        await expect(
            submitAndAutoRefreshCore({
                algokit,
                encodeSignedTransactions,
                waitForConfirmation,
                walletAddresses: [WALLET],
                network: 'mainnet',
                onConfirmed,
                signedTxns: [makeSigned(WALLET, EXTERNAL)],
            }),
        ).rejects.toThrow('algod rejected')

        expect(waitForConfirmation).not.toHaveBeenCalled()
        expect(onConfirmed).not.toHaveBeenCalled()
    })
})

describe('submitAndAutoRefresh (public, gated quantum submission)', () => {
    const PUBLIC_WALLET = 'PUBLIC_WALLET'
    const PUBLIC_EXTERNAL = 'PUBLIC_EXTERNAL'

    const makeAlgokit = (txid: Optional<string | string[]> = 'TX1') => ({
        client: {
            algod: {
                sendRawTransaction: vi.fn().mockReturnValue({
                    do: vi.fn().mockResolvedValue({ txid }),
                }),
            },
        },
    })
    const encodeSignedTransactions = vi
        .fn()
        .mockReturnValue([new Uint8Array([1])])

    const quantumAccount = (address: string): WalletAccount =>
        ({
            id: address,
            address,
            type: AccountTypes.quantum,
            keyPairId: 'kp-quantum',
        }) as WalletAccount

    const algo25Account = (address: string): WalletAccount =>
        ({
            id: address,
            address,
            type: AccountTypes.algo25,
            keyPairId: 'kp',
        }) as WalletAccount

    beforeEach(() => {
        useAccountsStore.getState().resetState()
        useNetworkStore.getState().resetState()
        mockWaitForConfirmation.mockReset().mockResolvedValue(undefined)
        mockSupportsQuantumBroadcast.mockReset().mockResolvedValue(true)
        mockConfigState.quantumMockSubmit = false
    })

    afterEach(() => {
        setOnConfirmedHandler(null)
        mockConfigState.quantumMockSubmit = false
    })

    test('quantum sender + node supports pqsig → real broadcast of the signed bytes + waits for confirmation', async () => {
        useAccountsStore.getState().setAccounts([quantumAccount(PUBLIC_WALLET)])
        mockSupportsQuantumBroadcast.mockResolvedValue(true)
        const onConfirmed = vi.fn()
        setOnConfirmedHandler(onConfirmed)
        const algokit = makeAlgokit('REALQTX')

        const txIds = await submitAndAutoRefresh(
            algokit,
            encodeSignedTransactions,
            [makeSigned(PUBLIC_WALLET, PUBLIC_EXTERNAL)],
        )

        expect(txIds).toEqual(['REALQTX'])
        expect(algokit.client.algod.sendRawTransaction).toHaveBeenCalled()
        await vi.waitFor(() =>
            expect(mockWaitForConfirmation).toHaveBeenCalled(),
        )
        await vi.waitFor(() =>
            expect(onConfirmed).toHaveBeenCalledWith(
                [PUBLIC_WALLET],
                expect.anything(),
            ),
        )
    })

    test('quantum sender + node does NOT support pqsig + mock flag off → throws QuantumBroadcastUnsupportedError, does not submit', async () => {
        useAccountsStore.getState().setAccounts([quantumAccount(PUBLIC_WALLET)])
        mockSupportsQuantumBroadcast.mockResolvedValue(false)
        const algokit = makeAlgokit('SHOULD_NOT_BE_USED')

        await expect(
            submitAndAutoRefresh(algokit, encodeSignedTransactions, [
                makeSigned(PUBLIC_WALLET, PUBLIC_EXTERNAL),
            ]),
        ).rejects.toBeInstanceOf(QuantumBroadcastUnsupportedError)

        expect(algokit.client.algod.sendRawTransaction).not.toHaveBeenCalled()
        expect(mockWaitForConfirmation).not.toHaveBeenCalled()
    })

    test('quantum sender + quantumMockSubmit flag on → synthetic txid, algod not called, wait skipped, onConfirmed still fires (probe short-circuited)', async () => {
        useAccountsStore.getState().setAccounts([quantumAccount(PUBLIC_WALLET)])
        mockConfigState.quantumMockSubmit = true
        // Even if the node is unsupported, the dev flag takes precedence.
        mockSupportsQuantumBroadcast.mockResolvedValue(false)
        const onConfirmed = vi.fn()
        setOnConfirmedHandler(onConfirmed)
        const algokit = makeAlgokit('TX1')

        const txIds = await submitAndAutoRefresh(
            algokit,
            encodeSignedTransactions,
            [makeSigned(PUBLIC_WALLET, PUBLIC_EXTERNAL)],
        )

        expect(txIds[0]).toMatch(/^[A-Z2-7]{52}$/)
        expect(algokit.client.algod.sendRawTransaction).not.toHaveBeenCalled()
        expect(mockWaitForConfirmation).not.toHaveBeenCalled()
        expect(mockSupportsQuantumBroadcast).not.toHaveBeenCalled()
        await vi.waitFor(() =>
            expect(onConfirmed).toHaveBeenCalledWith(
                [PUBLIC_WALLET],
                expect.anything(),
            ),
        )
    })

    test('uses the real submission path for a non-quantum (algo25) sender without probing capability — regression guard', async () => {
        useAccountsStore.getState().setAccounts([algo25Account(PUBLIC_WALLET)])
        const onConfirmed = vi.fn()
        setOnConfirmedHandler(onConfirmed)

        const algokit = makeAlgokit('REALTXID')

        const txIds = await submitAndAutoRefresh(
            algokit,
            encodeSignedTransactions,
            [makeSigned(PUBLIC_WALLET, PUBLIC_EXTERNAL)],
        )

        expect(txIds).toEqual(['REALTXID'])
        expect(algokit.client.algod.sendRawTransaction).toHaveBeenCalled()
        expect(mockSupportsQuantumBroadcast).not.toHaveBeenCalled()
        await vi.waitFor(() =>
            expect(mockWaitForConfirmation).toHaveBeenCalled(),
        )
        await vi.waitFor(() =>
            expect(onConfirmed).toHaveBeenCalledWith(
                [PUBLIC_WALLET],
                expect.anything(),
            ),
        )
    })
})
