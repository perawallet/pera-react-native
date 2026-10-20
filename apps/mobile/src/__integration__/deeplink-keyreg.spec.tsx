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

// A key-registration link is built by the Algorand deeplink adapter and queued
// for review. The genesis hash comes from the node the wallet is on, so a
// keyreg built against a custom node must carry that node's genesis and pass
// the signing pipeline's network check for it.

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
import { http, HttpResponse } from 'msw'
import { waitFor } from '@testing-library/react'
import { Notifier } from 'react-native-notifier'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    clearCustomNetwork,
    getExpectedGenesisHash,
    setCustomNetwork,
} from '@perawallet/wallet-core-chain-algorand/blockchain'
import { assertTransactionsMatchNetwork } from '@perawallet/wallet-core-chain-algorand/signing'
import {
    mockAlgodAccountInformation,
    mockAlgodTransactionParams,
} from '@perawallet/wallet-core-chain-algorand/test-handlers'
import {
    LEGACY_CHAIN_ID,
    type PeraTransaction,
    type UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import {
    useSigningRequest,
    type SignRequest,
} from '@perawallet/wallet-core-signing'
import {
    decodeFromBase64,
    encodeToBase64,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { server } from '@test-utils/msw-server'
import { render } from '@test-utils/render'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    drainPendingSignRequests,
    REVIEW_RECEIVER_ADDRESS,
    REVIEW_SIGNER_ADDRESS,
    seedAlgo25Signer,
} from '@test-utils/signing-review'
import { ConnectionsProvider } from '@modules/connections/shell'
import { useDeepLink } from '@modules/deeplink/hooks/useDeepLink'

// The mainnet genesis `mockAlgodTransactionParams` answers with by default.
const MAINNET_GENESIS = 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8='

// A LAN node with its own genesis: nothing about it may resolve to a baked
// network's values.
const CUSTOM_ALGOD = 'http://10.0.0.5:4001'
const CUSTOM_INDEXER = 'http://10.0.0.5:8980'
const CUSTOM_GENESIS = 'MvoAmMBVQX32w2gqkfMKShsYCbYio8wyepw6Zk5CgOw='
const CUSTOM_GENESIS_ID = 'dockernet-v1'

// The keys a native participation-key CSV emits: URL-safe and unpadded.
const VOTE_KEY = 'UU8zLMrFVfZPnzbnL6ThAArXFsznV3TvFVAun2ONcEI'
const SELECTION_KEY = '-lfw-Y04lTnllJfncgMjXuAePe8i8YyVeoR9c1Xi78c'
const STATE_PROOF_KEY =
    '3NoXc2sEWlvQZ7XIrwVJjgjM30ndhvwGgcqwKugk1u5W_iy_JITXrykuy0hUvAxbVv0njOgBPtGFsFif3yLJpg'

const onlineKeyregQuery = [
    'type=keyreg',
    `votekey=${VOTE_KEY}`,
    `selkey=${SELECTION_KEY}`,
    `sprfkey=${STATE_PROOF_KEY}`,
    'votefst=1300',
    'votelst=11300',
    'votekd=100',
    'fee=2000',
    'note=Consensus%20participation',
].join('&')

const onlineKeyregLink = (sender = REVIEW_SIGNER_ADDRESS, path = '') =>
    `algorand://${path}${sender}?${onlineKeyregQuery}`

const keyBytes = (urlSafeUnpadded: string): number[] => {
    const standard = urlSafeUnpadded.replaceAll('-', '+').replaceAll('_', '/')
    const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4)
    return Array.from(decodeFromBase64(padded))
}

type DeepLinkDispatch = ReturnType<typeof useDeepLink>['handleDeepLink']
const captured: {
    handleDeepLink: Optional<DeepLinkDispatch>
    pending: SignRequest[]
} = {
    handleDeepLink: undefined,
    pending: [],
}
const DeepLinkProbe = () => {
    captured.handleDeepLink = useDeepLink().handleDeepLink
    captured.pending = useSigningRequest().pendingSignRequests
    return null
}

const mountDeepLinks = async () => {
    render(
        <ConnectionsProvider>
            <DeepLinkProbe />
        </ConnectionsProvider>,
    )
    await waitFor(() => expect(captured.handleDeepLink).toBeTruthy())
}

const scan = async (url: string) => {
    const onError = vi.fn()
    const onSuccess = vi.fn()
    await captured.handleDeepLink!(url, false, 'qr', onError, onSuccess)
    return { onError, onSuccess }
}

const pendingRequests = () => captured.pending

/** The single queued keyreg, as the chain package built it. */
const queuedKeyreg = async (): Promise<PeraTransaction> => {
    await waitFor(() => expect(pendingRequests()).toHaveLength(1))
    const requests = pendingRequests()
    const [request] = requests
    expect(request).toMatchObject({
        type: 'transactions',
        sourceType: 'deeplink',
    })
    const txs = (request as { txs: UnsignedTransaction[] }).txs
    expect(txs).toHaveLength(1)
    return (txs[0].payload as { transaction: PeraTransaction }).transaction
}

const genesisOf = (transaction: PeraTransaction): string =>
    encodeToBase64(transaction.genesisHash!)

const expectToastTitled = (title: string) =>
    waitFor(() =>
        expect(Notifier.showNotification).toHaveBeenCalledWith(
            expect.objectContaining({ title }),
        ),
    )

describe('Flow: key registration from a deeplink', () => {
    const requested: string[] = []
    const record = ({ request }: { request: Request }) => {
        requested.push(request.url)
    }

    beforeAll(async () => {
        await setupTestDatabase()
        server.events.on('request:start', record)
    })

    afterAll(async () => {
        server.events.removeListener('request:start', record)
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        requested.length = 0
        drainPendingSignRequests()
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        clearCustomNetwork()
        useNetworkStore.getState().setMode('live')
        vi.mocked(Notifier.showNotification).mockClear()
        server.use(
            mockAlgodTransactionParams(),
            mockAlgodAccountInformation({
                address: REVIEW_SIGNER_ADDRESS,
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
        )
        await seedAlgo25Signer()
        await mountDeepLinks()
    })

    afterEach(() => {
        drainPendingSignRequests()
        clearCustomNetwork()
        useNetworkStore.getState().setMode('live')
    })

    describe('Given the wallet is on MainNet', () => {
        it('When an online keyreg link is scanned, then the keyreg is queued for review with every participation field', async () => {
            const { onSuccess } = await scan(onlineKeyregLink())

            expect(onSuccess).toHaveBeenCalledTimes(1)
            const tx = await queuedKeyreg()
            expect(tx).toMatchObject({
                type: 'keyreg',
                fee: 2000n,
                keyreg: {
                    voteFirst: 1300n,
                    voteLast: 11_300n,
                    voteKeyDilution: 100n,
                },
            })
            expect(tx.sender.toString()).toBe(REVIEW_SIGNER_ADDRESS)
            const keys = tx.keyreg!
            expect(Array.from(keys.voteKey!)).toEqual(keyBytes(VOTE_KEY))
            expect(Array.from(keys.selectionKey!)).toEqual(
                keyBytes(SELECTION_KEY),
            )
            expect(Array.from(keys.stateProofKey!)).toEqual(
                keyBytes(STATE_PROOF_KEY),
            )
            expect(new TextDecoder().decode(tx.note)).toBe(
                'Consensus participation',
            )
            expect(genesisOf(tx)).toBe(MAINNET_GENESIS)
            expect(() =>
                assertTransactionsMatchNetwork(
                    [tx],
                    'mainnet',
                    getExpectedGenesisHash('mainnet'),
                ),
            ).not.toThrow()
        })

        it('When a bare ARC-78 keyreg link is scanned, then an offline keyreg with no participation keys is queued', async () => {
            await scan(`algorand://${REVIEW_SIGNER_ADDRESS}?type=keyreg`)

            const tx = await queuedKeyreg()
            expect(tx.type).toBe('keyreg')
            expect(tx.sender.toString()).toBe(REVIEW_SIGNER_ADDRESS)
            expect(tx.keyreg?.voteKey).toBeUndefined()
            expect(tx.keyreg?.selectionKey).toBeUndefined()
        })

        it('When the sender is not in the wallet, then the unknown-account error shows and nothing is queued', async () => {
            const { onError } = await scan(
                onlineKeyregLink(REVIEW_RECEIVER_ADDRESS),
            )

            expect(onError).not.toHaveBeenCalled()
            expect(pendingRequests()).toEqual([])
            await expectToastTitled('deeplink.error.title_keyreg')
            expect(Notifier.showNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    description: 'deeplink.error.body_keyreg_unknown_account',
                }),
            )
        })

        it('When an online keyreg link is missing a participation field, then the keyreg error shows and nothing is queued', async () => {
            await scan(
                `algorand://${REVIEW_SIGNER_ADDRESS}?type=keyreg&votekey=${VOTE_KEY}&votefst=1300`,
            )

            expect(pendingRequests()).toEqual([])
            await expectToastTitled('deeplink.error.title_keyreg')
            expect(Notifier.showNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    description: 'deeplink.error.body_keyreg',
                }),
            )
        })
    })

    describe('Given the wallet is on a saved custom node', () => {
        beforeEach(() => {
            setCustomNetwork({
                algodUrl: CUSTOM_ALGOD,
                indexerUrl: CUSTOM_INDEXER,
                genesisHash: CUSTOM_GENESIS,
                genesisId: CUSTOM_GENESIS_ID,
            })
            useNetworkStore.getState().setMode('developer')
            useNetworkStore.getState().selectNetwork(LEGACY_CHAIN_ID, 'custom')
            // Answered only by the custom node; anything built elsewhere gets
            // the default mainnet genesis and fails the assertions below.
            server.use(
                http.get(`${CUSTOM_ALGOD}/v2/transactions/params`, () =>
                    HttpResponse.json({
                        'consensus-version': 'test',
                        fee: 0,
                        'min-fee': 1000,
                        'genesis-id': CUSTOM_GENESIS_ID,
                        'genesis-hash': CUSTOM_GENESIS,
                        'last-round': 1,
                    }),
                ),
            )
        })

        it("When a keyreg link is scanned, then it is built against the custom node with that node's genesis and passes the signing network check", async () => {
            await scan(onlineKeyregLink())

            const tx = await queuedKeyreg()
            expect(tx).toMatchObject({
                type: 'keyreg',
                genesisID: CUSTOM_GENESIS_ID,
            })
            expect(genesisOf(tx)).toBe(CUSTOM_GENESIS)
            expect(
                requested.some(url =>
                    url.startsWith(`${CUSTOM_ALGOD}/v2/transactions/params`),
                ),
            ).toBe(true)
            expect(() =>
                assertTransactionsMatchNetwork(
                    [tx],
                    'custom',
                    getExpectedGenesisHash('custom'),
                ),
            ).not.toThrow()
        })

        it('When the link names the custom node by its genesis hash, then it is accepted on that node', async () => {
            const gh = encodeURIComponent(CUSTOM_GENESIS)
            await scan(onlineKeyregLink(REVIEW_SIGNER_ADDRESS, `gh:${gh}/`))

            expect(genesisOf(await queuedKeyreg())).toBe(CUSTOM_GENESIS)
        })

        it('When the link names MainNet, then the network error shows and no transaction is built', async () => {
            const { onError } = await scan(
                onlineKeyregLink(REVIEW_SIGNER_ADDRESS, 'net:mainnet/'),
            )

            expect(onError).toHaveBeenCalledTimes(1)
            expect(pendingRequests()).toEqual([])
            expect(
                requested.some(url => url.includes('/v2/transactions/params')),
            ).toBe(false)
            await expectToastTitled('deeplink.error.title_network_mismatch')
        })
    })
})
