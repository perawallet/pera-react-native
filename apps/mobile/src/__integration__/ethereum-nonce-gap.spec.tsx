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

// A send at nonce 2 waits forever when nonce 1 never reached the node. Its row
// flags the gap, and unblocking it lands an empty transfer to the sender at
// nonce 1, after which the stuck send confirms.

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
import React from 'react'
import { act, renderHook } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    i18nKey,
    type ChainScope,
    type TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import {
    DEFAULT_EVM_RPC_RESPONSES,
    evmRpcHandlers,
    evmTransactionReceipt,
} from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { kmsCore, SeedScheme } from '@perawallet/wallet-core-kms'
import {
    broadcasterChainAdapters,
    getSubmissionAttemptsAtNonce,
    recordSubmissionAttempt,
    resolveSubmissionAttempt,
    useSigningRequest,
    type SigningResult,
    type SignRequest,
    type SourceMetadata,
} from '@perawallet/wallet-core-signing'
import {
    NonceGapFilledError,
    useBlockingGapQuery,
    useFillNonceGapMutation,
} from '@perawallet/wallet-core-transactions'
import { server } from '@test-utils/msw-server'
import { createTestQueryClient } from '@test-utils/render'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    drainPendingSignRequests,
    renderSignReview,
    screen,
    waitFor,
} from '@test-utils/signing-review'
import { VIEM_TRANSFER_NONCE_2 } from '@packages/chain-ethereum/src/signing/__tests__/fixtures'
import { readReplaceableTransaction } from '@packages/chain-ethereum/src/transfer/replacement'

const RPC_URL = 'https://mainnet.rpc.test/'

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
        chainEndpointsFor: (
            chainId: Parameters<typeof actual.chainEndpointsFor>[0],
        ) =>
            chainId === 'ethereum'
                ? { mainnet: [RPC_URL], sepolia: [RPC_URL] }
                : actual.chainEndpointsFor(chainId),
    }
})

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

// Hardhat account #0, from the public test mnemonic.
const SENDER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

const ETHEREUM_SENDER: WalletAccount = {
    id: 'eth-sender',
    custody: {
        kind: 'local',
        seed: SeedScheme.Bip39,
        hd: { account: 0, keyIndex: 0 },
    },
    chains: { ethereum: { address: SENDER, keyPairId: 'eth-key' } },
    name: 'Eth sender',
}

// Hardhat #0 over the fill: nothing to the sender at nonce 1, at the node's
// fast preset (3 gwei max, 1 gwei tip).
const SENDER_SIGNATURES: Record<string, string> = {
    '35cacb0dfa468052ee65b78d04759f9b9cc29221453b441473aded5aa8aca3b2':
        'fa841d2d6f010c671b8d3ff4a2ea9e5faa722541794e5b09cb355e94301b7b61769db94836f25e1f46baeaca8c7c6e28717a6af2933e41c7c4c2fc6faf83c8f500',
}

const signWithSenderKey = async (_keyPairId: string, digest: Uint8Array) => {
    const hex = Buffer.from(digest).toString('hex')
    const signature = SENDER_SIGNATURES[hex]
    if (!signature) throw new Error(`No fixture signature for digest ${hex}`)
    return Uint8Array.from(Buffer.from(signature, 'hex'))
}

const SEND_SUMMARY = {
    kind: 'transfer',
    title: { key: i18nKey('transactions.list_item.send') },
    direction: 'out',
    icon: 'send',
} as const

const STUCK_SEND: SigningResult = {
    signedData: {
        type: 'signed-transactions',
        signed: [
            {
                scope: SCOPE,
                id: 'unused',
                bytes: Uint8Array.from(
                    Buffer.from(VIEM_TRANSFER_NONCE_2.slice(2), 'hex'),
                ),
            },
        ],
        historyEntries: [
            { summary: SEND_SUMMARY, chainData: { family: 'evm' } },
        ],
    },
    signers: [],
}

const broadcastStuckSend = async (): Promise<string> => {
    const result = await broadcasterChainAdapters
        .get('ethereum')
        .createSubmitTransport(SCOPE)
        .send(STUCK_SEND, { type: 'local' } as SourceMetadata)
    if (result.type !== 'submitted') throw new Error('not submitted')
    return result.txIds[0]
}

// What the reconciler leaves once nonce 1 is past its grace and gone from the node.
const recordDroppedSend = async () => {
    const id = await recordSubmissionAttempt({
        scope: SCOPE,
        txIds: ['0xdropped'],
        flow: 'pipeline',
        sender: SENDER,
        nonce: 1,
    })
    await resolveSubmissionAttempt({ id, status: 'failed' })
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={createTestQueryClient()}>
        {children}
    </QueryClientProvider>
)

const pendingRecord = (id: string): TransactionRecord => ({
    id,
    scope: SCOPE,
    status: 'pending',
    summary: SEND_SUMMARY,
    chainData: { family: 'evm' },
})

// What the row's sheet does once the user picks unblock.
const queueFill = async (txId: string): Promise<SignRequest> => {
    const { result, unmount } = renderHook(
        () => ({
            mutation: useFillNonceGapMutation(),
            signing: useSigningRequest(),
        }),
        { wrapper },
    )
    await act(() => result.current.mutation.fill({ scope: SCOPE, txId }))
    const [request] = result.current.signing.pendingSignRequests
    act(() => {
        result.current.signing.removeSignRequest(request)
    })
    unmount()
    return request
}

describe('Flow: unblock an Ethereum send stuck behind a dropped nonce', () => {
    const sentRawTransactions: string[] = []
    let minedNonces = '0x1'
    const receipts = new Map<string, ReturnType<typeof evmTransactionReceipt>>()

    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        drainPendingSignRequests()
        await resetTestDatabase()
        useAccountsStore.getState().setAccounts([ETHEREUM_SENDER])
        useAccountsStore.getState().setSelectedAccountId(ETHEREUM_SENDER.id)
        sentRawTransactions.length = 0
        minedNonces = '0x1'
        receipts.clear()
        vi.spyOn(kmsCore, 'sign').mockImplementation(signWithSenderKey)
        server.use(
            ...evmRpcHandlers({
                rpcUrl: RPC_URL,
                responses: {
                    // The node holds nothing at nonce 1, so its pending count stops there.
                    eth_getTransactionCount: () => minedNonces as `0x${string}`,
                    eth_getTransactionReceipt: params =>
                        receipts.get(params[0] as string) ?? null,
                    eth_sendRawTransaction: params => {
                        sentRawTransactions.push(params[0] as string)
                        const respond =
                            DEFAULT_EVM_RPC_RESPONSES.eth_sendRawTransaction
                        return typeof respond === 'function'
                            ? respond(params)
                            : respond
                    },
                },
            }),
        )
    })

    afterEach(() => {
        vi.restoreAllMocks()
        useAccountsStore.getState().setAccounts([])
    })

    it('Given nonce 1 dropped and a send at nonce 2 pending, when the user unblocks it and confirms, then an empty transfer lands at nonce 1 and the send at nonce 2 confirms', async () => {
        await recordDroppedSend()
        const stuck = await broadcastStuckSend()
        sentRawTransactions.length = 0

        const { result: gap } = renderHook(
            () => useBlockingGapQuery(pendingRecord(stuck)),
            { wrapper },
        )
        await waitFor(() => expect(gap.current.isBlocked).toBe(true))

        const request = await queueFill(stuck)
        const { confirm } = renderSignReview(request)
        await waitFor(
            () =>
                expect(
                    screen.getByTestId('signing-confirm-slide'),
                ).toBeTruthy(),
            { timeout: 10_000 },
        )
        expect(screen.queryByTestId('signing_replaces_notice')).toBeNull()

        confirm()
        await waitFor(() => expect(sentRawTransactions).toHaveLength(1), {
            timeout: 10_000,
        })
        const fill = readReplaceableTransaction(sentRawTransactions[0])
        expect(fill).toMatchObject({
            nonce: 1,
            to: SENDER.toLowerCase(),
            gas: 21_000n,
            maxFeePerGas: 3_000_000_000n,
            maxPriorityFeePerGas: 1_000_000_000n,
        })
        expect(fill?.value ?? 0n).toBe(0n)

        // Both mine once the gap is filled.
        minedNonces = '0x3'
        const [fillAttempt] = await getSubmissionAttemptsAtNonce({
            scope: SCOPE,
            sender: SENDER,
            nonce: 1,
            statuses: ['submitted'],
        })
        for (const hash of [fillAttempt.txIds[0], stuck]) {
            receipts.set(
                hash,
                evmTransactionReceipt({
                    transactionHash: hash as `0x${string}`,
                }),
            )
        }
        await broadcasterChainAdapters
            .get('ethereum')
            .reconcileOpenSubmissions?.()

        const [settled] = await getSubmissionAttemptsAtNonce({
            scope: SCOPE,
            sender: SENDER,
            nonce: 2,
        })
        expect(settled.status).toBe('confirmed')
    })

    it('Given a send at nonce 2 whose earlier nonce the node holds, when its row asks, then it is not flagged and unblocking is refused', async () => {
        const stuck = await broadcastStuckSend()
        minedNonces = '0x2'

        const { result } = renderHook(
            () => ({
                gap: useBlockingGapQuery(pendingRecord(stuck)),
                mutation: useFillNonceGapMutation(),
                signing: useSigningRequest(),
            }),
            { wrapper },
        )

        await expect(
            act(() =>
                result.current.mutation.fill({ scope: SCOPE, txId: stuck }),
            ),
        ).rejects.toBeInstanceOf(NonceGapFilledError)
        expect(result.current.gap.isBlocked).toBe(false)
        expect(result.current.signing.pendingSignRequests).toHaveLength(0)
    })
})
