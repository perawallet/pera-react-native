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

// An Ethereum send enters history from the submission ledger the moment it is
// broadcast, survives an offline read, and gives way to the chain's own row.
// The flow enters at the broadcaster's submit transport.

import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import {
    i18nKey,
    type ChainContext,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type {
    SigningResult,
    SourceMetadata,
} from '@perawallet/wallet-core-signing'
import type { EvmHistoryItemResponse } from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import {
    SENDER,
    VIEM_TRANSFER_NONCE_0,
} from '@packages/chain-ethereum/src/signing/__tests__/fixtures'
import { http, HttpResponse, server } from '@test-utils/msw-server'

// The integration setup registers whichever chains config enables.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal)
    return {
        ...withBackend,
        config: {
            ...withBackend.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

// The integration setup loads the Pera query client before this file's config
// mock exists, and the client reads its deployments once, so every module under
// test is loaded afresh.
vi.resetModules()
const { getPendingTransactionRecords, getTransactionHistoryWithPending } =
    await import('@perawallet/wallet-core-transactions')
const { evmHistoryItem, evmRpcHandlers } =
    await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const { createEvmBroadcasterAdapter } =
    await import('@packages/chain-ethereum/src/transfer/broadcaster')
const { evmChainOf } = await import('@packages/chain-ethereum/src/chains/table')
const { historyPath } =
    await import('@packages/chain-ethereum/src/history/api/endpoints')
const { resetTestDatabase, setupTestDatabase, teardownTestDatabase } =
    await import('@test-utils/database-setup')

const RPC_URL = 'https://mainnet.rpc.test/'

// The app resolves RPC endpoints from build config, which tests leave unset.
const CONTEXT: ChainContext = {
    getScope: () => SCOPE,
    getEndpoints: () => ({ mainnet: RPC_URL, sepolia: RPC_URL }),
    getPeraBackend: () => ({ baseUrl: '', services: new Set() }),
    timeouts: { readMs: 1000, submitMs: 1000 },
    kms: {} as ChainContext['kms'],
}

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const BYTES = Uint8Array.from(
    Buffer.from(VIEM_TRANSFER_NONCE_0.slice(2), 'hex'),
)
const SUMMARY_TITLE = i18nKey('transactions.list_item.send')

const sendSigned = (): SigningResult => ({
    signedData: {
        type: 'signed-transactions',
        signed: [{ scope: SCOPE, id: 'unused', bytes: BYTES }],
        historyEntries: [
            {
                summary: {
                    kind: 'transfer',
                    title: { key: SUMMARY_TITLE },
                    direction: 'out',
                    icon: 'send',
                },
                chainData: { family: 'evm' },
            },
        ],
    },
    signers: [],
})

const serveHistory = (results: EvmHistoryItemResponse[]) =>
    server.use(
        http.get(`*${historyPath(':chainId', ':address')}`, () =>
            HttpResponse.json({ next: null, previous: null, results }),
        ),
    )

describe('Flow: an Ethereum send in history', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        server.use(...evmRpcHandlers({ rpcUrl: RPC_URL }))
    })

    // The transaction's hash, as the broadcaster reports it.
    const broadcast = async (): Promise<string> => {
        const result = await createEvmBroadcasterAdapter(
            CONTEXT,
            evmChainOf('ethereum'),
        )
            .createSubmitTransport(SCOPE)
            .send(sendSigned(), { type: 'local' } as SourceMetadata)
        if (result.type !== 'submitted') throw new Error('not submitted')
        return result.txIds[0]
    }

    it('Given a broadcast the backend has not listed, when history loads, then the send is first and pending', async () => {
        const hash = await broadcast()
        serveHistory([])

        // The ledger holds the checksummed sender; the stored address is lowercase.
        const page = await getTransactionHistoryWithPending(
            SENDER.toLowerCase(),
            SCOPE,
        )

        expect(page.items).toHaveLength(1)
        expect(page.items[0]).toMatchObject({
            id: hash,
            status: 'pending',
            summary: { title: { key: SUMMARY_TITLE } },
        })
    })

    it('Given a broadcast and no network, when the pending records are read, then the send is still there', async () => {
        const hash = await broadcast()
        server.use(http.all('*', () => HttpResponse.error()))

        const records = await getPendingTransactionRecords({
            address: SENDER.toLowerCase(),
            scope: SCOPE,
            listedIds: new Set(),
        })

        expect(records.map(record => record.id)).toEqual([hash])
    })

    it('Given the backend now lists the mined send, when history loads, then one record has its hash and it is confirmed', async () => {
        const hash = await broadcast()
        serveHistory([evmHistoryItem({ hash, from: SENDER })])

        const page = await getTransactionHistoryWithPending(
            SENDER.toLowerCase(),
            SCOPE,
        )

        const matching = page.items.filter(record => record.id === hash)
        expect(matching).toHaveLength(1)
        expect(matching[0].status).toBe('confirmed')
    })
})
