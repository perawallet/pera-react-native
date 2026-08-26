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
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import {
    submitAndAutoRefresh,
    submitAndAutoRefreshCore,
} from '../submitAndAutoRefresh'
import { setOnConfirmedHandler } from '../onConfirmedRegistry'
import {
    getOpenSubmissionAttempts,
    getSubmissionAttemptsByTxIds,
    SubmissionAttemptsSchema,
} from '../../../db'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    useNetworkStore,
    type PeraSignedTransaction,
} from '@perawallet/wallet-core-blockchain'

const { mockWaitForConfirmation } = vi.hoisted(() => ({
    mockWaitForConfirmation: vi.fn(),
}))

vi.mock('algosdk', async importOriginal => ({
    ...(await importOriginal<typeof import('algosdk')>()),
    waitForConfirmation: mockWaitForConfirmation,
}))

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
            verifyTxnLanded: vi.fn(),
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
            verifyTxnLanded: vi.fn(),
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
            verifyTxnLanded: vi.fn(),
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
            verifyTxnLanded: vi.fn(),
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
            verifyTxnLanded: vi.fn(),
            walletAddresses: [WALLET],
            network: 'mainnet',
            onConfirmed,
            signedTxns: [makeSigned(EXTERNAL, 'OTHER_EXTERNAL')],
        })
        await flushMicrotasks()

        expect(waitForConfirmation).toHaveBeenCalled()
        expect(onConfirmed).not.toHaveBeenCalled()
    })

    test('submits via algod and waits for confirmation on the real path', async () => {
        const algokit = makeAlgokit('REALTXID')
        const waitForConfirmation = vi.fn().mockResolvedValue(undefined)
        const onConfirmed = vi.fn()

        const { txIds } = await submitAndAutoRefreshCore({
            algokit,
            encodeSignedTransactions,
            waitForConfirmation,
            verifyTxnLanded: vi.fn(),
            walletAddresses: [WALLET],
            network: 'mainnet',
            onConfirmed,
            signedTxns: [makeSigned(WALLET, EXTERNAL)],
        })

        expect(algokit.client.algod.sendRawTransaction).toHaveBeenCalled()
        expect(txIds).toEqual(['REALTXID'])
        await vi.waitFor(() =>
            expect(waitForConfirmation).toHaveBeenCalledWith('REALTXID'),
        )
    })

    test('resolves as success when an unknown-outcome submit failure verifies as landed on-chain', async () => {
        // The user's scenario in PERA-4896: the POST response is lost on a
        // flaky connection but the node received the bytes — the transaction
        // confirms two rounds later while the app claims failure.
        const timeout = new Error('The operation timed out')
        timeout.name = 'TimeoutError'
        const algokit = {
            client: {
                algod: {
                    sendRawTransaction: vi.fn().mockReturnValue({
                        do: vi.fn().mockRejectedValue(timeout),
                    }),
                },
            },
        }
        const verifyTxnLanded = vi.fn().mockResolvedValue(undefined)
        const waitForConfirmation = vi.fn().mockResolvedValue(undefined)
        const onConfirmed = vi.fn()

        const signedWithTxId = {
            txn: {
                sender: addr(WALLET),
                payment: { receiver: addr(EXTERNAL), amount: 0n },
                txID: () => 'LOCAL_TX',
            },
            sig: new Uint8Array(),
        } as unknown as PeraSignedTransaction

        const result = await submitAndAutoRefreshCore({
            algokit,
            encodeSignedTransactions,
            waitForConfirmation,
            verifyTxnLanded,
            walletAddresses: [WALLET],
            network: 'mainnet',
            onConfirmed,
            signedTxns: [signedWithTxId],
        })
        await flushMicrotasks()

        expect(verifyTxnLanded).toHaveBeenCalledWith('LOCAL_TX')
        expect(result).toEqual({ txIds: ['LOCAL_TX'] })
        expect(onConfirmed).toHaveBeenCalledWith([WALLET], 'mainnet')
    })

    test('rethrows the unknown-outcome error after chain verification retries come up empty', async () => {
        const timeout = new Error('The operation timed out')
        timeout.name = 'TimeoutError'
        const algokit = {
            client: {
                algod: {
                    sendRawTransaction: vi.fn().mockReturnValue({
                        do: vi.fn().mockRejectedValue(timeout),
                    }),
                },
            },
        }
        const verifyTxnLanded = vi
            .fn()
            .mockRejectedValue(new Error('not found'))
        const sleep = vi.fn().mockResolvedValue(undefined)
        const onConfirmed = vi.fn()

        const signedWithTxId = {
            txn: { sender: addr(WALLET), txID: () => 'LOCAL_TX' },
            sig: new Uint8Array(),
        } as unknown as PeraSignedTransaction

        const promise = submitAndAutoRefreshCore({
            algokit,
            encodeSignedTransactions,
            waitForConfirmation: vi.fn(),
            verifyTxnLanded,
            sleep,
            walletAddresses: [WALLET],
            network: 'mainnet',
            onConfirmed,
            signedTxns: [signedWithTxId],
        })

        await expect(promise).rejects.toThrow('unknown-outcome')
        expect(verifyTxnLanded).toHaveBeenCalledTimes(2)
        expect(onConfirmed).not.toHaveBeenCalled()
    })

    test('does not verify chain state for a definitive node rejection', async () => {
        const sender = 'B'.repeat(58)
        const rejection = new Error(
            `overspend (account ${sender}, data {MicroAlgos:{Raw:100}}, tried to spend {5000})`,
        )
        const algokit = {
            client: {
                algod: {
                    sendRawTransaction: vi.fn().mockReturnValue({
                        do: vi.fn().mockRejectedValue(rejection),
                    }),
                },
            },
        }
        const verifyTxnLanded = vi.fn()

        const signedWithTxId = {
            txn: { sender: addr(WALLET), txID: () => 'LOCAL_TX' },
            sig: new Uint8Array(),
        } as unknown as PeraSignedTransaction

        await expect(
            submitAndAutoRefreshCore({
                algokit,
                encodeSignedTransactions,
                waitForConfirmation: vi.fn(),
                verifyTxnLanded,
                walletAddresses: [WALLET],
                network: 'mainnet',
                onConfirmed: vi.fn(),
                signedTxns: [signedWithTxId],
            }),
        ).rejects.toThrow('overspend')

        expect(verifyTxnLanded).not.toHaveBeenCalled()
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
                verifyTxnLanded: vi.fn(),
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

describe('submitAndAutoRefreshCore ledger (PERA-4588)', () => {
    let db: Database
    let teardown: () => void

    beforeEach(async () => {
        const result = createTestDatabase()
        db = result.db
        teardown = result.teardown
        await runMigrations(db, migrations)
    })

    afterEach(() => {
        teardown()
    })

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

    const signedWithTxId = {
        txn: {
            sender: addr(WALLET),
            payment: { receiver: addr(EXTERNAL), amount: 0n },
            txID: () => 'LOCAL_TX',
            firstValid: 1000n,
            lastValid: 2000n,
        },
        sig: new Uint8Array(),
    } as unknown as PeraSignedTransaction

    const baseInput = (overrides: Record<string, unknown> = {}) => ({
        algokit: makeAlgokit(),
        encodeSignedTransactions,
        waitForConfirmation: vi.fn().mockResolvedValue(undefined),
        verifyTxnLanded: vi.fn(),
        walletAddresses: [WALLET],
        network: 'mainnet',
        onConfirmed: vi.fn(),
        signedTxns: [signedWithTxId],
        db,
        ...overrides,
    })

    test('writes a ledger row before the POST with derived txids, validity and intent', async () => {
        const rowCountAtPost: number[] = []
        const algokit = {
            client: {
                algod: {
                    sendRawTransaction: vi.fn().mockReturnValue({
                        do: vi.fn(async () => {
                            const rows = await db
                                .select()
                                .from(SubmissionAttemptsSchema)
                                .all()
                            rowCountAtPost.push(rows.length)
                            return { txid: 'TX1' }
                        }),
                    }),
                },
            },
        }
        await submitAndAutoRefreshCore(
            baseInput({
                algokit,
                ledger: {
                    flow: 'rekey',
                    intentKey: { kind: 'rekey', address: WALLET },
                    sender: WALLET,
                },
            }),
        )
        await flushMicrotasks()

        // The ledger row exists while the POST is in flight — the write
        // strictly precedes the broadcast.
        expect(rowCountAtPost).toEqual([1])
        expect(algokit.client.algod.sendRawTransaction).toHaveBeenCalled()

        // The background confirmation then resolves the row to confirmed.
        const all = await db.select().from(SubmissionAttemptsSchema).all()
        expect(all).toHaveLength(1)
        expect(all[0]).toMatchObject({
            network: 'mainnet',
            flow: 'rekey',
            sender: WALLET,
            intentKeyJson: JSON.stringify({ kind: 'rekey', address: WALLET }),
            lastValid: 2000,
            status: 'confirmed',
        })
    })

    test('resolves the row to confirmed once the background confirmation settles', async () => {
        await submitAndAutoRefreshCore(baseInput())
        await flushMicrotasks()

        const all = await db.select().from(SubmissionAttemptsSchema).all()
        expect(all).toHaveLength(1)
        expect(all[0]).toMatchObject({ status: 'confirmed' })
    })

    test('leaves the row open when the background confirmation wait fails', async () => {
        const waitForConfirmation = vi
            .fn()
            .mockRejectedValue(new Error('timeout'))
        await submitAndAutoRefreshCore(baseInput({ waitForConfirmation }))
        await flushMicrotasks()

        const rows = await getOpenSubmissionAttempts({ db })
        expect(rows).toHaveLength(1)
        expect(rows[0]!.status).toBe('submitted')
        expect(rows[0]!.resolvedAt).toBeNull()
    })

    test('resolves the row to failed on a definitive node rejection', async () => {
        const rejection = new Error(
            `overspend (account ${'B'.repeat(58)}, data {MicroAlgos:{Raw:100}}, tried to spend {5000})`,
        )
        const algokit = {
            client: {
                algod: {
                    sendRawTransaction: vi.fn().mockReturnValue({
                        do: vi.fn().mockRejectedValue(rejection),
                    }),
                },
            },
        }

        await expect(
            submitAndAutoRefreshCore(baseInput({ algokit })),
        ).rejects.toThrow('overspend')

        const rows = await db.select().from(SubmissionAttemptsSchema).all()
        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({ status: 'failed' })
    })

    test('leaves the row open (unknown) when an unknown-outcome submit cannot be verified', async () => {
        const timeout = new Error('The operation timed out')
        timeout.name = 'TimeoutError'
        const algokit = {
            client: {
                algod: {
                    sendRawTransaction: vi.fn().mockReturnValue({
                        do: vi.fn().mockRejectedValue(timeout),
                    }),
                },
            },
        }
        const verifyTxnLanded = vi
            .fn()
            .mockRejectedValue(new Error('not found'))

        await expect(
            submitAndAutoRefreshCore(baseInput({ algokit, verifyTxnLanded })),
        ).rejects.toThrow('unknown-outcome')

        const rows = await getOpenSubmissionAttempts({ db })
        expect(rows).toHaveLength(1)
        expect(rows[0]!.status).toBe('unknown')
        expect(rows[0]!.resolvedAt).toBeNull()
    })

    test('resolves the row to confirmed when an unknown-outcome submit verifies as landed', async () => {
        const timeout = new Error('The operation timed out')
        timeout.name = 'TimeoutError'
        const algokit = {
            client: {
                algod: {
                    sendRawTransaction: vi.fn().mockReturnValue({
                        do: vi.fn().mockRejectedValue(timeout),
                    }),
                },
            },
        }
        const verifyTxnLanded = vi.fn().mockResolvedValue(undefined)

        const result = await submitAndAutoRefreshCore(
            baseInput({ algokit, verifyTxnLanded }),
        )
        await flushMicrotasks()

        expect(result).toEqual({ txIds: ['LOCAL_TX'] })
        const rows = await db.select().from(SubmissionAttemptsSchema).all()
        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({ status: 'confirmed' })
    })

    test('writes no row when no txid can be derived', async () => {
        const signedWithoutTxId = {
            txn: { sender: addr(WALLET) },
            sig: new Uint8Array(),
        } as unknown as PeraSignedTransaction
        const algokit = {
            client: {
                algod: {
                    sendRawTransaction: vi.fn().mockReturnValue({
                        do: vi.fn().mockResolvedValue({ txid: 'TX1' }),
                    }),
                },
            },
        }

        await submitAndAutoRefreshCore(
            baseInput({ signedTxns: [signedWithoutTxId], algokit }),
        )
        await flushMicrotasks()

        const rows = await db.select().from(SubmissionAttemptsSchema).all()
        expect(rows).toHaveLength(0)
    })

    test('a ledger write failure never blocks the submit (best-effort)', async () => {
        // No db passed → getDatabase() throws inside the ledger write; the
        // submit must still succeed.
        const algokit = makeAlgokit('TX1')
        const result = await submitAndAutoRefreshCore(
            baseInput({ db: undefined, algokit }),
        )
        await flushMicrotasks()

        expect(result).toEqual({ txIds: ['TX1'] })
        expect(algokit.client.algod.sendRawTransaction).toHaveBeenCalled()
    })
})

describe('submitAndAutoRefresh (public)', () => {
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
    })

    afterEach(() => {
        setOnConfirmedHandler(null)
    })

    test('submits the group through the real path and confirms in the background', async () => {
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
