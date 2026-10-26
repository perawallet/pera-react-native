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

// A pending Ethereum send is re-priced at its own nonce: the replacement is
// built from the bytes the ledger kept, reviewed like any request with a note
// of what it replaces, signed, and recorded against the send it replaces.

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
} from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { kmsCore, SeedScheme } from '@perawallet/wallet-core-kms'
import {
    broadcasterChainAdapters,
    getSubmissionAttemptsAtNonce,
    useSigningRequest,
    type SigningResult,
    type SignRequest,
    type SourceMetadata,
} from '@perawallet/wallet-core-signing'
import {
    useReplaceableTransactionQuery,
    useReplaceTransactionMutation,
    type TransactionReplacementKind,
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
import { VIEM_TRANSFER_NONCE_0 } from '@packages/chain-ethereum/src/signing/__tests__/fixtures'
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
                ? { mainnet: RPC_URL, sepolia: RPC_URL }
                : actual.chainEndpointsFor(chainId),
    }
})

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

// Wei per gas: the original's 20 gwei and 1 gwei tip, bumped by 10%.
const BUMPED_MAX_FEE = 22_000_000_000n
const BUMPED_TIP = 1_100_000_000n

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

// The pending send pays 20 gwei and a 1 gwei tip; the node's fast preset
// (1 gwei base and tip) is below the 10% bump, so both replacements pay 22
// and 1.1 gwei. Signatures Hardhat #0 made over those exact digests.
const SENDER_SIGNATURES: Record<string, string> = {
    // Speed up: the same 1 ETH transfer, re-priced.
    '6f83aa9e22d2b393ee7e970926222a4895eb8d1241ae370d2f5811e0b7852f2c':
        'e3cc2ebc4f7e0207292797e483ff1aa92368ec2eb8cc8709af52e89265e391fa586b538366df6cb76c2bbbdb0955d449d5648381a00f5e1c90c9c2ba0db11d2d01',
    // Cancel: nothing to the sender itself.
    a5cf5223386b47c7a28dedea1a22f7a462af307d0684a804dec3fa34e3b761d2:
        'd6a8daab8cd1944d5cfc815eb6754b62492ed099ccd9daf0028067c97dd3cc757080916f2afdb62f14fda0fc4d3296146ea49284888fcc221f2f61fd5f4c7f7301',
}

const signWithSenderKey = async (_keyPairId: string, digest: Uint8Array) => {
    const hex = Buffer.from(digest).toString('hex')
    const signature = SENDER_SIGNATURES[hex]
    if (!signature) throw new Error(`No fixture signature for digest ${hex}`)
    return Uint8Array.from(Buffer.from(signature, 'hex'))
}

const PENDING_SEND: SigningResult = {
    signedData: {
        type: 'signed-transactions',
        signed: [
            {
                scope: SCOPE,
                id: 'unused',
                bytes: Uint8Array.from(
                    Buffer.from(VIEM_TRANSFER_NONCE_0.slice(2), 'hex'),
                ),
            },
        ],
        historyEntries: [
            {
                summary: {
                    kind: 'transfer',
                    title: { key: i18nKey('transactions.list_item.send') },
                    direction: 'out',
                    icon: 'send',
                },
                chainData: { family: 'evm' },
            },
        ],
    },
    signers: [],
}

const broadcastPendingSend = async (): Promise<string> => {
    const result = await broadcasterChainAdapters
        .get('ethereum')
        .createSubmitTransport(SCOPE)
        .send(PENDING_SEND, { type: 'local' } as SourceMetadata)
    if (result.type !== 'submitted') throw new Error('not submitted')
    return result.txIds[0]
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={createTestQueryClient()}>
        {children}
    </QueryClientProvider>
)

// What the history row's sheet does once the user picks an action: the
// request it queues is then reviewed in the real signing sheet.
const queueReplacement = async (
    txId: string,
    kind: TransactionReplacementKind,
): Promise<SignRequest> => {
    const { result, unmount } = renderHook(
        () => ({
            mutation: useReplaceTransactionMutation(),
            signing: useSigningRequest(),
        }),
        { wrapper },
    )
    await act(() =>
        result.current.mutation.replace({ scope: SCOPE, txId, kind }),
    )
    const [request] = result.current.signing.pendingSignRequests
    act(() => {
        result.current.signing.removeSignRequest(request)
    })
    unmount()
    return request
}

describe('Flow: speed up or cancel a pending Ethereum send', () => {
    const sentRawTransactions: string[] = []

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
        vi.spyOn(kmsCore, 'sign').mockImplementation(signWithSenderKey)
        server.use(
            ...evmRpcHandlers({
                rpcUrl: RPC_URL,
                responses: {
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

    const replaceAndConfirm = async (kind: TransactionReplacementKind) => {
        const pending = await broadcastPendingSend()
        sentRawTransactions.length = 0
        const request = await queueReplacement(pending, kind)

        const { confirm } = renderSignReview(request)
        await waitFor(
            () =>
                expect(
                    screen.getByTestId('signing-confirm-slide'),
                ).toBeTruthy(),
            { timeout: 10_000 },
        )
        expect(screen.getByTestId('signing_replaces_notice')).toBeTruthy()
        expect(
            screen.getByText('transactions.replacement.review_notice'),
        ).toBeTruthy()

        confirm()
        await waitFor(() => expect(sentRawTransactions).toHaveLength(1), {
            timeout: 10_000,
        })
        const replacement = readReplaceableTransaction(sentRawTransactions[0])
        const attempts = await getSubmissionAttemptsAtNonce({
            scope: SCOPE,
            sender: SENDER,
            nonce: 0,
        })
        return { replacement, attempts }
    }

    it('Given a pending send, when the user speeds it up and confirms, then the same transfer reaches the node at its nonce with both fees bumped and is recorded against it', async () => {
        const { replacement, attempts } = await replaceAndConfirm('speed-up')

        expect(replacement).toMatchObject({
            nonce: 0,
            value: 10n ** 18n,
            maxFeePerGas: BUMPED_MAX_FEE,
            maxPriorityFeePerGas: BUMPED_TIP,
        })
        expect(attempts).toHaveLength(2)
        expect(attempts[1].replacesAttemptId).toBe(attempts[0].id)
    })

    it('Given a pending send, when the user cancels it and confirms, then an empty transfer to the sender reaches the node at its nonce', async () => {
        const { replacement, attempts } = await replaceAndConfirm('cancel')

        expect(replacement).toMatchObject({
            nonce: 0,
            to: SENDER.toLowerCase(),
            gas: 21_000n,
            maxFeePerGas: BUMPED_MAX_FEE,
            maxPriorityFeePerGas: BUMPED_TIP,
        })
        // RLP drops a zero value, so a parsed cancel carries none.
        expect(replacement?.value ?? 0n).toBe(0n)
        expect(attempts[1].replacesAttemptId).toBe(attempts[0].id)
    })

    it('Given a pending Algorand transaction, when its row asks, then it is not offered for replacement', () => {
        const record: TransactionRecord = {
            id: 'ALGO-TX',
            scope: { chainId: 'algorand', networkId: 'mainnet' },
            status: 'pending',
            summary: {
                kind: 'transfer',
                title: { key: i18nKey('transactions.list_item.send') },
                direction: 'out',
                icon: 'send',
            },
            chainData: { family: 'algorand' },
        }

        const { result } = renderHook(
            () => useReplaceableTransactionQuery(record),
            { wrapper },
        )

        expect(result.current.isReplaceable).toBe(false)
    })
})
