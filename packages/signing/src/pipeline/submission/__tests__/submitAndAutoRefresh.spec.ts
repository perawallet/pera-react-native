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

    test('submits via algod and waits for confirmation on the real path', async () => {
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
