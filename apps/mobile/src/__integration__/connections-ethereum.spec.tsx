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

// A WalletConnect v2 session spanning Algorand and Ethereum, through the same
// provider, registry, handler and approval sheet as `connections-flow.spec.tsx`
// with only `@reown/walletkit` stubbed. Ethereum's `dappConnect` is the gate.

import React from 'react'
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type Mock,
} from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { Address, Transaction, TransactionType } from 'algosdk'
import { http, HttpResponse } from 'msw'
import { render } from '@test-utils/render'
import { server, setSuiteUnhandledRequestMode } from '@test-utils/msw-server'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { renderSignReview, seedAlgo25Signer } from '@test-utils/signing-review'
import { walletKitStub, type FakeWalletKit } from '@test-utils/walletkit-stub'
import {
    makeProposal,
    makeRequest,
    makeSession,
    MAINNET_CHAIN_ID,
    TESTNET_CHAIN_ID,
    TOPIC as V2_SESSION_TOPIC,
    V2_URI,
} from '@packages/walletconnect/src/v2/__tests__/fakeWalletKit'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { encodeTransactionRaw } from '@perawallet/wallet-core-chain-algorand/blockchain'
import {
    mockAlgodAccountInformation,
    mockAlgodStatus,
    mockAlgodTransactionParams,
    mockIndexerSearchForAccounts,
} from '@perawallet/wallet-core-chain-algorand/test-handlers'
import {
    getSelectedScope,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import {
    resetConnectionPairingStateForTesting,
    useConnectionRegistry,
    type ConnectionRegistryClient,
} from '@perawallet/wallet-core-connections'
import type { ConnectionOrigin } from '@perawallet/wallet-extension-connections'
import {
    DEFAULT_EVM_RPC_RESPONSES,
    evmRpcHandlers,
    evmTransactionReceipt,
} from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { kmsCore } from '@perawallet/wallet-core-kms'
import { nativeAssetFor, upsertAssets } from '@perawallet/wallet-core-assets'
import { useSecurityStore } from '@perawallet/wallet-core-security'
import {
    findTransactionBatch,
    signTransactionsInBackground,
} from '@perawallet/wallet-core-signing'
import { approvalGate } from '@packages/signing/src/pipeline/approvalGate'
import { __resetSigningActorRegistryForTests } from '@packages/signing/src/hooks/useSigningActorLifecycle'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import {
    decodeFromBase64,
    encodeToBase64,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { useSigningStore } from '@packages/signing/src/store'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { ConnectionsProvider } from '@modules/connections/shell'
import { BottomSheetManager } from '@modules/bottom-sheet'
import { AnalyticsMetadataKey, WalletConnectEvent } from '@analytics'
import { getAllPressables, isElementDisabled } from '@test-utils/rnw'
import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'
import {
    recordAnalyticsEvents,
    type AnalyticsRecorder,
} from '@test-utils/analytics-recorder'
import { expectFlowEvents } from './__fixtures__/analytics-flows'

// The integration setup registers whichever chains config enables, and v2
// builds no client without a Reown project id.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        // A built request prices on the selected network's node, which the
        // test build has no URL for.
        chainEndpointsFor: (chainId: ChainId) =>
            chainId === 'ethereum'
                ? { mainnet: 'https://mainnet.rpc.test/' }
                : actual.chainEndpointsFor(chainId),
        config: {
            ...actual.config,
            reownProjectId: 'integration-project-id',
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

const STORED_ETH_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
const CHECKSUMMED_ETH_ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const ETH_MAINNET = 'eip155:1'

const ALGORAND_ACCOUNT: WalletAccount = {
    id: 'eth-conn-algo',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'algo-key' },
    },
    name: 'Trading',
}
// A seed-derived account: a signer the pipeline accepts, which a request needs
// to reach review.
const ETHEREUM_ACCOUNT: WalletAccount = {
    id: 'eth-conn-eth',
    custody: {
        kind: 'local',
        seed: 'bip39',
        hd: { account: 0, keyIndex: 0 },
    },
    chains: {
        ethereum: { address: STORED_ETH_ADDRESS, keyPairId: 'eth-key' },
    },
    name: 'Ether',
}

const ETHEREUM_METHODS = [
    'eth_sendTransaction',
    'personal_sign',
    'eth_signTypedData_v4',
    'wallet_switchEthereumChain',
    'wallet_sendCalls',
    'eth_accounts',
    'eth_requestAccounts',
    'eth_chainId',
    'wallet_getCapabilities',
    'wallet_getCallsStatus',
    'wallet_showCallsStatus',
]

const IN_APP_ORIGIN: ConnectionOrigin = { source: 'in-app' }

const captured: { registry: Optional<ConnectionRegistryClient> } = {
    registry: undefined,
}
const RegistryProbe = () => {
    captured.registry = useConnectionRegistry()
    return null
}

const pendingSignRequests = () => useSigningStore.getState().pendingSignRequests

const findButton = (label: string): Optional<HTMLButtonElement> =>
    getAllPressables().find(button =>
        (button.textContent ?? '').includes(label),
    ) as Optional<HTMLButtonElement>

const mountProvider = async () => {
    render(
        <>
            <ConnectionsProvider>
                <RegistryProbe />
            </ConnectionsProvider>
            <BottomSheetManager />
        </>,
    )
    await waitFor(() => {
        expect(captured.registry).toBeTruthy()
    })
}

const waitForWalletKit = (): Promise<FakeWalletKit> =>
    waitFor(
        () => {
            const client = walletKitStub.last()
            if (!client) throw new Error('WalletKit was never initialised')
            return client
        },
        { timeout: 15_000 },
    )

const propose = async (
    namespaces: Parameters<typeof makeProposal>[0],
): Promise<FakeWalletKit> => {
    await act(async () => {
        await captured.registry!.pair(V2_URI, { origin: IN_APP_ORIGIN })
    })
    const walletKit = await waitForWalletKit()
    act(() => {
        walletKit.emit('session_proposal', makeProposal(namespaces))
    })
    return walletKit
}

const eip155Namespace = (
    type: 'requiredNamespaces' | 'optionalNamespaces',
) => ({
    [type]: {
        eip155: {
            chains: [ETH_MAINNET],
            methods: ['eth_sendTransaction'],
            events: [],
        },
    },
})

const bothRequired = () => ({
    requiredNamespaces: {
        algorand: {
            chains: [MAINNET_CHAIN_ID],
            methods: ['algo_signTxn'],
            events: [],
        },
        eip155: {
            chains: [ETH_MAINNET],
            methods: ['eth_sendTransaction'],
            events: [],
        },
    },
})

const selectRows = async (...accounts: WalletAccount[]) => {
    await waitFor(() => {
        expect(findButton('common.connect.label')).toBeTruthy()
    })
    for (const { id } of accounts) {
        const testId = `wc_account_row_${id}`
        await waitFor(() => expect(screen.getByTestId(testId)).toBeTruthy(), {
            timeout: 5000,
        })
        fireEvent.click(screen.getByTestId(testId))
    }
    await waitFor(() => {
        expect(isElementDisabled(findButton('common.connect.label')!)).toBe(
            false,
        )
    })
}

const connect = async (walletKit: FakeWalletKit) => {
    fireEvent.click(findButton('common.connect.label')!)
    await waitFor(() => {
        expect(walletKit.approveSession).toHaveBeenCalledTimes(1)
    })
    await waitFor(async () => {
        expect(
            await getProvider().connections.store.get(V2_SESSION_TOPIC),
        ).toBeTruthy()
    })
}

const approvedNamespaces = (walletKit: FakeWalletKit) =>
    (walletKit.approveSession as Mock).mock.calls[0][0].namespaces as Record<
        string,
        { chains: string[]; accounts: string[]; methods: string[] }
    >

describe('Flow: a v2 session spanning Algorand and Ethereum', () => {
    let analytics: AnalyticsRecorder
    beforeEach(() => {
        analytics = recordAnalyticsEvents()
    })
    afterEach(() => {
        analytics.restore()
    })

    setSuiteUnhandledRequestMode('bypass')

    beforeEach(async () => {
        resetTestKeystore()
        walletKitStub.reset()
        captured.registry = undefined
        useAccountsStore
            .getState()
            .setAccounts([ALGORAND_ACCOUNT, ETHEREUM_ACCOUNT])
        await getProvider().connections.store.clear()
        resetConnectionPairingStateForTesting()
        vi.clearAllMocks()
    })

    afterEach(async () => {
        // A module singleton with no per-test reset.
        useSigningStore.getState().resetState()
        await getProvider().connections.store.clear()
        useAccountsStore.getState().setAccounts([])
        useRemoteConfigStore.getState().resetState()
    })

    describe('with Ethereum dappConnect on', () => {
        beforeEach(() => {
            setCapabilityOverrides({ dappConnect: true }, 'ethereum')
        })

        it('Given an eip155-only proposal, when the sheet opens, then only the Ethereum account is listed and Connect approves its checksummed address', async () => {
            await mountProvider()
            // The approved methods are the requested ones the wallet lists, so
            // the dApp asks for the whole set and the two it must never get.
            const walletKit = await propose({
                requiredNamespaces: {
                    eip155: {
                        chains: [ETH_MAINNET],
                        methods: ETHEREUM_METHODS,
                        events: [],
                    },
                },
                optionalNamespaces: {
                    eip155: {
                        chains: [ETH_MAINNET],
                        methods: [
                            'eth_signTransaction',
                            'eth_sendRawTransaction',
                        ],
                        events: [],
                    },
                },
            })

            await selectRows(ETHEREUM_ACCOUNT)
            expect(screen.queryByText('Trading')).toBeNull()
            await connect(walletKit)

            const namespaces = approvedNamespaces(walletKit)
            expect(Object.keys(namespaces)).toEqual(['eip155'])
            expect(namespaces.eip155.chains).toEqual([ETH_MAINNET])
            expect(namespaces.eip155.accounts).toEqual([
                `${ETH_MAINNET}:${CHECKSUMMED_ETH_ADDRESS}`,
            ])
            expect(namespaces.eip155.methods).toEqual(ETHEREUM_METHODS)
            expectFlowEvents(analytics, 'walletConnectApprove', 'ethereum')
        })

        it('Given an eip155-only proposal, when the user cancels, then the rejection is tracked on ethereum', async () => {
            await mountProvider()
            await propose(eip155Namespace('requiredNamespaces'))

            await waitFor(() => {
                expect(findButton('common.cancel.label')).toBeTruthy()
            })
            await act(async () => {
                fireEvent.click(findButton('common.cancel.label')!)
            })

            await waitFor(() => {
                expectFlowEvents(analytics, 'walletConnectReject', 'ethereum')
            })
        })

        it('Given a proposal requiring algorand and eip155, when the user selects both accounts, then each namespace carries only its own chain’s address', async () => {
            await mountProvider()
            const walletKit = await propose(bothRequired())

            await selectRows(ALGORAND_ACCOUNT, ETHEREUM_ACCOUNT)
            await connect(walletKit)

            const namespaces = approvedNamespaces(walletKit)
            expect(namespaces.algorand.accounts).toEqual([
                `${MAINNET_CHAIN_ID}:${ALGO25_TEST_ADDRESS}`,
            ])
            expect(namespaces.eip155.accounts).toEqual([
                `${ETH_MAINNET}:${CHECKSUMMED_ETH_ADDRESS}`,
            ])
            expect(
                analytics
                    .events([WalletConnectEvent.SessionApproved])
                    .map(
                        ({ payload }) =>
                            payload?.[AnalyticsMetadataKey.ChainId],
                    ),
            ).toEqual(['algorand', 'ethereum'])
        })

        it('Given a settled eip155 session, when the dApp calls methods the wallet does not list, then they are refused with 4200 without a review and eth_chainId is answered', async () => {
            await mountProvider()
            const walletKit = await propose(
                eip155Namespace('requiredNamespaces'),
            )
            await selectRows(ETHEREUM_ACCOUNT)
            await connect(walletKit)

            const send = (id: number, method: string) =>
                act(() => {
                    walletKit.emit(
                        'session_request',
                        makeRequest({
                            id,
                            method,
                            params: [],
                            chainId: ETH_MAINNET,
                        }),
                    )
                })
            send(1, 'wallet_addEthereumChain')
            send(2, 'eth_signTransaction')
            send(3, 'eth_chainId')
            send(4, 'eth_sendRawTransaction')
            send(5, 'eth_sign')

            await waitFor(() => {
                expect(walletKit.respondSessionRequest).toHaveBeenCalledTimes(5)
            })
            const answers = new Map(
                (walletKit.respondSessionRequest as Mock).mock.calls.map(
                    ([{ response }]) => [response.id, response],
                ),
            )
            for (const id of [1, 2, 4, 5]) {
                expect(answers.get(id)).toMatchObject({
                    error: { code: 4200 },
                })
            }
            expect(answers.get(3)).toMatchObject({ result: '0x1' })
            expect(pendingSignRequests()).toHaveLength(0)
        })

        describe('eth_sendTransaction', () => {
            const RECIPIENT = '0x2c7536E3605D9C16a7a3D7b1898e529396a65c23'
            const HASH = `0x${'ab'.repeat(32)}`

            const settle = async () => {
                server.use(...evmRpcHandlers())
                await mountProvider()
                const walletKit = await propose(
                    eip155Namespace('requiredNamespaces'),
                )
                await selectRows(ETHEREUM_ACCOUNT)
                await connect(walletKit)
                return walletKit
            }

            const sendTransaction = (
                walletKit: FakeWalletKit,
                transaction: Record<string, unknown>,
            ) =>
                act(() => {
                    walletKit.emit(
                        'session_request',
                        makeRequest({
                            id: 7,
                            method: 'eth_sendTransaction',
                            params: [transaction],
                            chainId: ETH_MAINNET,
                        }),
                    )
                })

            const answerOf = (walletKit: FakeWalletKit) =>
                (walletKit.respondSessionRequest as Mock).mock.calls.at(-1)?.[0]
                    .response

            type QueuedRequest = {
                approve: (
                    signed: unknown[],
                    submission?: { txIds: string[] },
                ) => Promise<void>
                reject: () => Promise<void>
            }

            // The nonce comes from the submission ledger.
            beforeAll(setupTestDatabase)
            beforeEach(resetTestDatabase)
            // A request approved without the review leaves its actor in the
            // module registry, which keeps the next request's review blank.
            beforeEach(__resetSigningActorRegistryForTests)
            afterAll(teardownTestDatabase)

            const queued = async (): Promise<QueuedRequest> => {
                await waitFor(() => {
                    expect(pendingSignRequests()).toHaveLength(1)
                })
                return pendingSignRequests()[0] as unknown as QueuedRequest
            }

            it('Given a valid request, when it is approved with a submitted hash, then the dApp receives that hash', async () => {
                const walletKit = await settle()

                sendTransaction(walletKit, {
                    from: CHECKSUMMED_ETH_ADDRESS,
                    to: RECIPIENT,
                    value: '0x1',
                    gasPrice: '0x3b9aca00',
                })
                const request = await queued()
                // The broadcaster leg is pinned by the chain's own spec.
                await act(async () => {
                    await request.approve([], { txIds: [HASH] })
                })

                await waitFor(() => {
                    expect(answerOf(walletKit)).toMatchObject({
                        id: 7,
                        result: HASH,
                    })
                })
            })

            it('Given a valid request, when it is queued, then the review shows the Ethereum transaction with its max fee', async () => {
                const walletKit = await settle()
                // Mounted first so the request FAQ is acknowledged before the
                // request arrives; otherwise its sheet covers the review.
                renderSignReview()

                sendTransaction(walletKit, {
                    from: CHECKSUMMED_ETH_ADDRESS,
                    to: RECIPIENT,
                    value: '0x1',
                })
                await queued()

                await waitFor(
                    () => {
                        expect(
                            screen.getAllByTestId('signing_transaction_review'),
                        ).not.toHaveLength(0)
                    },
                    { timeout: 5000 },
                )
                expect(
                    screen.getAllByTestId('ethereum_max_fee'),
                ).not.toHaveLength(0)
                expect(
                    screen.queryByText(
                        'signing.transaction_view.invalid_title',
                    ),
                ).toBeNull()
            })

            it('Given a queued request, when the user rejects it, then the dApp receives 4001', async () => {
                const walletKit = await settle()
                sendTransaction(walletKit, {
                    from: CHECKSUMMED_ETH_ADDRESS,
                    to: RECIPIENT,
                })
                const request = await queued()

                await act(async () => {
                    await request.reject()
                })

                await waitFor(() => {
                    expect(answerOf(walletKit)).toMatchObject({
                        error: { code: 4001 },
                    })
                })
            })

            describe('an unlimited token approval', () => {
                const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
                const SPENDER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
                // approve(SPENDER, 2^256-1)
                const APPROVE_DATA = `0x095ea7b3${SPENDER.slice(2).toLowerCase().padStart(64, '0')}${'f'.repeat(64)}`

                const reviewApproval = async () => {
                    await upsertAssets({
                        items: [
                            {
                                ...nativeAssetFor('ethereum'),
                                assetId: USDC,
                                name: 'USD Coin',
                                unitName: 'USDC',
                                decimals: 6,
                            },
                        ],
                        scope: { chainId: 'ethereum', networkId: 'mainnet' },
                    })
                    const walletKit = await settle()
                    renderSignReview()
                    sendTransaction(walletKit, {
                        from: CHECKSUMMED_ETH_ADDRESS,
                        to: USDC,
                        value: '0x0',
                        data: APPROVE_DATA,
                    })
                    const request = await queued()
                    await waitFor(
                        () => {
                            expect(
                                screen.getAllByTestId(
                                    'signing_transaction_review',
                                ),
                            ).not.toHaveLength(0)
                        },
                        { timeout: 5000 },
                    )
                    return { walletKit, request }
                }

                describe('with contractDecoding on', () => {
                    beforeEach(() => {
                        // One override per chain, so dappConnect is restated.
                        setCapabilityOverrides(
                            { dappConnect: true, contractDecoding: true },
                            'ethereum',
                        )
                    })

                    it('Given a dApp approves a spender for unlimited USDC, when it is reviewed, then it reads as an approval with the unlimited warning and approving it answers the dApp', async () => {
                        const { walletKit, request } = await reviewApproval()

                        await waitFor(() => {
                            expect(
                                screen.getAllByTestId(
                                    'message-signing-spend-approval-warning',
                                ),
                            ).not.toHaveLength(0)
                        })
                        expect(
                            screen.getAllByText(
                                'transactions.list_item.approval',
                            ),
                        ).not.toHaveLength(0)
                        expect(
                            screen.getAllByText(
                                'signing.spend_approval.unlimited',
                            ),
                        ).not.toHaveLength(0)
                        await waitFor(() => {
                            expect(
                                screen.getAllByText('USDC'),
                            ).not.toHaveLength(0)
                        })
                        expect(
                            screen.queryByTestId(
                                'ethereum_contract_call_warning',
                            ),
                        ).toBeNull()

                        fireEvent.click(
                            screen.getAllByTestId(
                                'message-signing-spend-approval-warning',
                            )[0],
                        )
                        await waitFor(() => {
                            expect(
                                screen.getAllByTestId(
                                    'message-signing-spend-approval-row-unlimited',
                                ),
                            ).not.toHaveLength(0)
                        })

                        await act(async () => {
                            await request.approve([], { txIds: [HASH] })
                        })
                        await waitFor(() => {
                            expect(answerOf(walletKit)).toMatchObject({
                                id: 7,
                                result: HASH,
                            })
                        })
                    })
                })

                it('Given contractDecoding is off, when the same approval is reviewed, then it is still an unrecognised contract call', async () => {
                    await reviewApproval()

                    await waitFor(() => {
                        expect(
                            screen.getAllByTestId(
                                'ethereum_contract_call_warning',
                            ),
                        ).not.toHaveLength(0)
                    })
                    expect(
                        screen.getAllByText(
                            'transactions.list_item.contract_call',
                        ),
                    ).not.toHaveLength(0)
                    expect(
                        screen.queryByTestId(
                            'message-signing-spend-approval-warning',
                        ),
                    ).toBeNull()
                })
            })

            it.each([
                ['a type 0x4 transaction', { type: '0x4' }, -32_602],
                ['a contract creation', { to: undefined }, -32_602],
                ['a blob transaction', { type: '0x3' }, -32_602],
                ['a from the session does not hold', { from: RECIPIENT }, 4100],
                [
                    'a chainId that is not the active chain',
                    { chainId: '0xaa36a7' },
                    -32_602,
                ],
            ])(
                'Given %s, when it arrives, then it is refused with %i and nothing is queued',
                async (_, fields, code) => {
                    const walletKit = await settle()

                    sendTransaction(walletKit, {
                        from: CHECKSUMMED_ETH_ADDRESS,
                        to: RECIPIENT,
                        ...fields,
                    })

                    await waitFor(() => {
                        expect(answerOf(walletKit)).toMatchObject({
                            error: { code },
                        })
                    })
                    expect(pendingSignRequests()).toHaveLength(0)
                },
            )
        })

        describe('wallet_sendCalls', () => {
            const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
            const ROUTER = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'
            // approve(ROUTER, 1e6), then a call the router reads it in.
            const APPROVE = {
                to: TOKEN,
                data: `0x095ea7b3${ROUTER.slice(2).toLowerCase().padStart(64, '0')}${(1_000_000).toString(16).padStart(64, '0')}`,
            }
            const SWAP = { to: ROUTER, data: '0x5ae401dc', value: '0x0' }

            // Ethereum keys never exist in JS, so every digest gets one real
            // r‖s‖v: the bytes parse and recover, and differ per transaction.
            const FIXED_SIGNATURE = Uint8Array.from(
                Buffer.from(
                    '923c0f4c3ec362322e052c7d1f1d6ea2a364621802f4428c6508a4fe71a655ef332789ab7ace0f5c627bcda10589e4e437c568bfb39cd09f4dc40da8789c05ac01',
                    'hex',
                ),
            )

            const sent: string[] = []

            /** Mines each send at once, with the receipt status of its place in the batch. */
            const node = (statuses: readonly ('0x1' | '0x0')[] = []) => {
                server.use(
                    ...evmRpcHandlers({
                        responses: {
                            eth_getTransactionCount: () =>
                                `0x${sent.length.toString(16)}`,
                            eth_sendRawTransaction: params => {
                                const respond =
                                    DEFAULT_EVM_RPC_RESPONSES.eth_sendRawTransaction
                                const hash = (
                                    typeof respond === 'function'
                                        ? respond(params)
                                        : respond
                                ) as `0x${string}`
                                sent.push(hash)
                                return hash
                            },
                            eth_getTransactionByHash: params =>
                                sent.includes(params[0] as string)
                                    ? ({ blockNumber: null } as never)
                                    : null,
                            eth_getTransactionReceipt: params => {
                                const index = sent.indexOf(params[0] as string)
                                return index === -1
                                    ? null
                                    : evmTransactionReceipt({
                                          transactionHash:
                                              params[0] as `0x${string}`,
                                          status: statuses[index] ?? '0x1',
                                      })
                            },
                        },
                    }),
                )
            }

            const settle = async (statuses?: readonly ('0x1' | '0x0')[]) => {
                node(statuses)
                await mountProvider()
                const walletKit = await propose(
                    eip155Namespace('requiredNamespaces'),
                )
                await selectRows(ETHEREUM_ACCOUNT)
                await connect(walletKit)
                return walletKit
            }

            const request = (
                walletKit: FakeWalletKit,
                id: number,
                method: string,
                params: unknown[],
            ) =>
                act(() => {
                    walletKit.emit(
                        'session_request',
                        makeRequest({
                            id,
                            method,
                            params,
                            chainId: ETH_MAINNET,
                        }),
                    )
                })

            const sendCalls = (
                walletKit: FakeWalletKit,
                batch: Record<string, unknown> = {},
            ) =>
                request(walletKit, 9, 'wallet_sendCalls', [
                    {
                        version: '2.0.0',
                        id: 'approve-then-swap',
                        chainId: '0x1',
                        from: CHECKSUMMED_ETH_ADDRESS,
                        atomicRequired: false,
                        calls: [APPROVE, SWAP],
                        ...batch,
                    },
                ])

            const answerTo = (walletKit: FakeWalletKit, id: number) =>
                (walletKit.respondSessionRequest as Mock).mock.calls
                    .map(([{ response }]) => response)
                    .find(response => response.id === id)

            const batchSettled = () =>
                waitFor(
                    async () => {
                        const batch = await findTransactionBatch({
                            chainId: 'ethereum',
                            batchId: 'approve-then-swap',
                            senders: [CHECKSUMMED_ETH_ADDRESS],
                        })
                        expect(batch).toBeTruthy()
                        expect(batch?.outcome).not.toBe('running')
                    },
                    { timeout: 15_000 },
                )

            const callsStatus = async (walletKit: FakeWalletKit) => {
                request(walletKit, 11, 'wallet_getCallsStatus', [
                    'approve-then-swap',
                ])
                await waitFor(() => {
                    expect(answerTo(walletKit, 11)).toBeTruthy()
                })
                return answerTo(walletKit, 11).result
            }

            // Approves through the review's own gate, so the pipeline signs the
            // first call and hands it to the batch.
            const approveReview = async (following = 1) => {
                await waitFor(() => {
                    expect(pendingSignRequests()).toHaveLength(1)
                })
                const [review] = pendingSignRequests() as unknown as {
                    id: string
                    txs: unknown[]
                    followingTxs: unknown[]
                }[]
                expect(review.txs).toHaveLength(1)
                expect(review.followingTxs).toHaveLength(following)
                await waitFor(() => {
                    expect(approvalGate.isRegistered(review.id)).toBe(true)
                })
                act(() => {
                    approvalGate.approve(review.id)
                })
            }

            beforeAll(setupTestDatabase)
            beforeEach(async () => {
                // Earlier tests answer their requests directly, leaving their
                // actors parked at the review; only one actor runs at a time.
                __resetSigningActorRegistryForTests()
                await resetTestDatabase()
                sent.length = 0
                useSecurityStore.getState().setAppLockActive(false)
                vi.spyOn(kmsCore, 'sign').mockResolvedValue(FIXED_SIGNATURE)
            })
            afterEach(() => {
                vi.restoreAllMocks()
            })
            afterAll(teardownTestDatabase)

            it('Given an approve-then-swap batch, when it is reviewed once, then both calls land in order and its status is 200 with two receipts', async () => {
                const walletKit = await settle()

                sendCalls(walletKit)
                await approveReview()

                await waitFor(() => {
                    expect(answerTo(walletKit, 9)).toMatchObject({
                        result: { id: 'approve-then-swap' },
                    })
                })
                await batchSettled()
                const status = await callsStatus(walletKit)

                expect(sent).toHaveLength(2)
                expect(status).toMatchObject({
                    id: 'approve-then-swap',
                    chainId: '0x1',
                    atomic: false,
                    status: 200,
                })
                expect(
                    status.receipts.map(
                        (receipt: { transactionHash: string }) =>
                            receipt.transactionHash,
                    ),
                ).toEqual(sent)
                // The swap was signed with no second review.
                expect(pendingSignRequests()).toHaveLength(0)
            })

            it('Given a batch of one call, when it is reviewed and approved, then it lands and its status is 200 with one receipt', async () => {
                const walletKit = await settle()

                sendCalls(walletKit, { calls: [APPROVE] })
                await approveReview(0)

                await waitFor(() => {
                    expect(answerTo(walletKit, 9)).toMatchObject({
                        result: { id: 'approve-then-swap' },
                    })
                })
                await batchSettled()
                const status = await callsStatus(walletKit)

                expect(sent).toHaveLength(1)
                expect(status).toMatchObject({ status: 200 })
                expect(status.receipts).toHaveLength(1)
            })

            it('Given the swap reverts, when the batch runs, then its status is 600', async () => {
                const walletKit = await settle(['0x1', '0x0'])

                sendCalls(walletKit)
                await approveReview()
                await batchSettled()

                expect(await callsStatus(walletKit)).toMatchObject({
                    status: 600,
                })
                expect(sent).toHaveLength(2)
            })

            it('Given the approval reverts, when the batch runs, then its status is 500 and the swap is never broadcast', async () => {
                const walletKit = await settle(['0x0'])

                sendCalls(walletKit)
                await approveReview()
                await batchSettled()

                expect(await callsStatus(walletKit)).toMatchObject({
                    status: 500,
                })
                expect(sent).toHaveLength(1)
            })

            it('Given a contract call no approved review showed, when it is signed in the background under a made-up approval, then the pipeline refuses it', async () => {
                const walletKit = await settle()
                sendCalls(walletKit)
                await waitFor(() => {
                    expect(pendingSignRequests()).toHaveLength(1)
                })
                const [review] = pendingSignRequests() as unknown as {
                    txs: Parameters<typeof signTransactionsInBackground>[0]
                    reject: () => Promise<void>
                }[]
                const [unexplained] = review.txs
                await act(async () => {
                    await review.reject()
                })
                useSigningStore.getState().resetState()
                __resetSigningActorRegistryForTests()

                const signing = signTransactionsInBackground(
                    [unexplained],
                    { name: 'Forged', description: 'No review behind it' },
                    { token: 'made-up', positions: [0] },
                )

                await expect(signing).rejects.toMatchObject({
                    name: 'ReviewRequiredError',
                })
                expect(kmsCore.sign).not.toHaveBeenCalled()
                expect(sent).toHaveLength(0)
            })

            it('Given a batch that requires atomic execution, when it arrives, then it is refused with 5760 and nothing is shown', async () => {
                const walletKit = await settle()

                sendCalls(walletKit, { atomicRequired: true })

                await waitFor(() => {
                    expect(answerTo(walletKit, 9)).toMatchObject({
                        error: { code: 5760 },
                    })
                })
                expect(pendingSignRequests()).toHaveLength(0)
            })

            it('Given a held account, when the dApp asks for capabilities, then atomic execution is reported unsupported', async () => {
                const walletKit = await settle()

                request(walletKit, 10, 'wallet_getCapabilities', [
                    CHECKSUMMED_ETH_ADDRESS,
                    ['0x1'],
                ])

                await waitFor(() => {
                    expect(answerTo(walletKit, 10)).toMatchObject({
                        result: {
                            '0x1': { atomic: { status: 'unsupported' } },
                        },
                    })
                })
            })
        })

        describe('network switching and session events', () => {
            const ETH_SEPOLIA = 'eip155:11155111'
            const EVENTS = ['chainChanged', 'accountsChanged']
            const ALGORAND_TESTNET_GENESIS_HASH =
                'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI='

            beforeAll(setupTestDatabase)
            beforeEach(resetTestDatabase)
            afterAll(teardownTestDatabase)

            afterEach(() => {
                useNetworkStore.getState().setMode('live')
            })

            const answers = (walletKit: FakeWalletKit) =>
                new Map(
                    (walletKit.respondSessionRequest as Mock).mock.calls.map(
                        ([{ response }]) => [response.id, response],
                    ),
                )

            const emitRequest = (
                walletKit: FakeWalletKit,
                request: Parameters<typeof makeRequest>[0],
            ) =>
                act(() => {
                    walletKit.emit('session_request', makeRequest(request))
                })

            const settleEthereum = async (chains = [ETH_MAINNET]) => {
                await mountProvider()
                const walletKit = await propose({
                    requiredNamespaces: {
                        eip155: {
                            chains,
                            methods: [
                                'eth_sendTransaction',
                                'wallet_switchEthereumChain',
                                'eth_chainId',
                            ],
                            events: EVENTS,
                        },
                    },
                })
                await selectRows(ETHEREUM_ACCOUNT)
                await connect(walletKit)
                return walletKit
            }

            describe('in developer mode, with an Algorand signature in flight', () => {
                const paymentFrom = (sender: string): Transaction =>
                    new Transaction({
                        type: TransactionType.pay,
                        sender: Address.fromString(sender),
                        suggestedParams: {
                            fee: 1000n,
                            minFee: 1000n,
                            flatFee: true,
                            firstValid: 1000n,
                            lastValid: 2000n,
                            genesisID: 'testnet-v1.0',
                            genesisHash: new Uint8Array(
                                decodeFromBase64(ALGORAND_TESTNET_GENESIS_HASH),
                            ),
                        },
                        paymentParams: {
                            receiver: Address.fromString(HD_TEST_ADDRESS),
                            amount: 1_000_000n,
                        },
                    })

                beforeEach(async () => {
                    useNetworkStore.getState().setMode('developer')
                    await seedAlgoAsset('testnet')
                    server.use(
                        http.get('*/v1/projects/', () => HttpResponse.json([])),
                        mockAlgodTransactionParams({
                            response: {
                                fee: 1000,
                                'min-fee': 1000,
                                'genesis-id': 'testnet-v1.0',
                                'genesis-hash': ALGORAND_TESTNET_GENESIS_HASH,
                            },
                        }),
                        mockAlgodAccountInformation({
                            address: ALGO25_TEST_ADDRESS,
                            response: {
                                amount: 5_000_000,
                                'min-balance': 100_000,
                            },
                        }),
                        mockAlgodAccountInformation({
                            address: HD_TEST_ADDRESS,
                            response: {
                                amount: 5_000_000,
                                'min-balance': 100_000,
                            },
                        }),
                        mockAlgodStatus({ response: { 'last-round': 100 } }),
                        mockIndexerSearchForAccounts(),
                    )
                })

                it('Given a switch to the selected network the session lacks, when the user allows it, then the session gains the network, nothing in the wallet moves and the Algorand signature stays pending', async () => {
                    // Resolved from the registered adapter once a test runs.
                    const ALGORAND_TESTNET = TESTNET_CHAIN_ID
                    const signer = await seedAlgo25Signer()
                    useAccountsStore
                        .getState()
                        .setAccounts([signer, ETHEREUM_ACCOUNT])
                    await mountProvider()
                    const walletKit = await propose({
                        requiredNamespaces: {
                            algorand: {
                                chains: [ALGORAND_TESTNET],
                                methods: ['algo_signTxn'],
                                events: [],
                            },
                            eip155: {
                                chains: [ETH_MAINNET],
                                methods: [
                                    'wallet_switchEthereumChain',
                                    'eth_chainId',
                                ],
                                events: EVENTS,
                            },
                        },
                    })
                    await selectRows(signer, ETHEREUM_ACCOUNT)
                    await connect(walletKit)
                    const algorandBefore = getSelectedScope('algorand')

                    emitRequest(walletKit, {
                        id: 21,
                        chainId: ALGORAND_TESTNET,
                        params: [
                            [
                                {
                                    txn: encodeToBase64(
                                        encodeTransactionRaw(
                                            paymentFrom(ALGO25_TEST_ADDRESS),
                                        ),
                                    ),
                                },
                            ],
                        ],
                    })
                    await waitFor(
                        () => {
                            expect(pendingSignRequests()).toHaveLength(1)
                        },
                        { timeout: 15_000 },
                    )

                    emitRequest(walletKit, {
                        id: 22,
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: '0xaa36a7' }],
                        chainId: ETH_MAINNET,
                    })
                    await waitFor(() => {
                        expect(
                            findButton('walletconnect.switch_network.confirm'),
                        ).toBeTruthy()
                    })
                    expect(walletKit.updateSession).not.toHaveBeenCalled()

                    fireEvent.click(
                        findButton('walletconnect.switch_network.confirm')!,
                    )
                    await waitFor(() => {
                        expect(answers(walletKit).get(22)).toMatchObject({
                            result: null,
                        })
                    })

                    expect(walletKit.updateSession).toHaveBeenCalledTimes(1)
                    expect(getSelectedScope('algorand')).toEqual(algorandBefore)
                    expect(getSelectedScope('ethereum')).toEqual({
                        chainId: 'ethereum',
                        networkId: 'sepolia',
                    })
                    expect(useNetworkStore.getState().mode).toBe('developer')
                    expect(pendingSignRequests()).toHaveLength(1)

                    // The extended session now serves requests on the new chain.
                    emitRequest(walletKit, {
                        id: 23,
                        method: 'eth_chainId',
                        params: [],
                        chainId: ETH_SEPOLIA,
                    })
                    await waitFor(() => {
                        expect(answers(walletKit).get(23)).toMatchObject({
                            result: '0xaa36a7',
                        })
                    })
                })
            })

            describe('in live mode', () => {
                it('Given requests the wallet cannot honour, when the dApp sends them, then it gets 4901 for the other tier, 4902 for an unknown chain and 4200 for wallet_addEthereumChain', async () => {
                    const walletKit = await settleEthereum()

                    emitRequest(walletKit, {
                        id: 31,
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: '0xaa36a7' }],
                        chainId: ETH_MAINNET,
                    })
                    emitRequest(walletKit, {
                        id: 32,
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: '0x89' }],
                        chainId: ETH_MAINNET,
                    })
                    emitRequest(walletKit, {
                        id: 33,
                        method: 'wallet_addEthereumChain',
                        params: [{ chainId: '0x89' }],
                        chainId: ETH_MAINNET,
                    })

                    await waitFor(() => {
                        expect(
                            walletKit.respondSessionRequest,
                        ).toHaveBeenCalledTimes(3)
                    })
                    const sent = answers(walletKit)
                    expect(sent.get(31)).toMatchObject({
                        error: { code: 4901 },
                    })
                    expect(sent.get(32)).toMatchObject({
                        error: { code: 4902 },
                    })
                    expect(sent.get(33)).toMatchObject({
                        error: { code: 4200 },
                    })
                    expect(walletKit.updateSession).not.toHaveBeenCalled()
                    expect(getSelectedScope('ethereum').networkId).toBe(
                        'mainnet',
                    )
                })

                it('Given a switch to the selected network the session holds, when it arrives, then it is answered null without a prompt', async () => {
                    const walletKit = await settleEthereum()

                    emitRequest(walletKit, {
                        id: 34,
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: '0x1' }],
                        chainId: ETH_MAINNET,
                    })

                    await waitFor(() => {
                        expect(answers(walletKit).get(34)).toMatchObject({
                            result: null,
                        })
                    })
                    expect(walletKit.updateSession).not.toHaveBeenCalled()
                    expect(
                        findButton('walletconnect.switch_network.confirm'),
                    ).toBeUndefined()
                })
            })

            describe('session events', () => {
                const ALGORAND_ONLY_TOPIC = 'f'.repeat(64)

                // An Algorand-only session beside the eip155 one, as a second
                // dApp would leave it: in the SDK and in the store.
                const openAlgorandOnlySession = async (
                    walletKit: FakeWalletKit,
                ) => {
                    walletKit.getActiveSessions()[ALGORAND_ONLY_TOPIC] =
                        makeSession({ topic: ALGORAND_ONLY_TOPIC })
                    await getProvider().connections.store.upsert({
                        id: ALGORAND_ONLY_TOPIC,
                        kind: 'walletconnect-v2',
                        name: 'Algorand dApp',
                        peer: { name: 'Algorand dApp' },
                        accounts: [ALGO25_TEST_ADDRESS],
                        status: 'active',
                        createdAt: 1,
                        lastActiveAt: 1,
                        metadata: {
                            topic: ALGORAND_ONLY_TOPIC,
                            chains: [MAINNET_CHAIN_ID],
                            methods: ['algo_signTxn'],
                            expiry: 1_800_000_000,
                        },
                    })
                }

                const emitted = (walletKit: FakeWalletKit) =>
                    (walletKit.emitSessionEvent as Mock).mock.calls.map(
                        ([call]) => call,
                    )

                it('Given a session approved for both Ethereum networks, when the wallet leaves live mode, then it hears chainChanged and an Algorand-only one hears nothing', async () => {
                    const walletKit = await settleEthereum([
                        ETH_MAINNET,
                        ETH_SEPOLIA,
                    ])
                    await openAlgorandOnlySession(walletKit)

                    act(() => {
                        useNetworkStore.getState().setMode('developer')
                    })

                    await waitFor(() => {
                        expect(emitted(walletKit)).toEqual([
                            {
                                topic: V2_SESSION_TOPIC,
                                event: {
                                    name: 'chainChanged',
                                    data: '0xaa36a7',
                                },
                                chainId: ETH_SEPOLIA,
                            },
                        ])
                    })
                    expect(walletKit.updateSession).not.toHaveBeenCalled()
                })

                it('Given the session holds the only Ethereum account, when the wallet removes it, then the dApp hears accountsChanged with no accounts', async () => {
                    const walletKit = await settleEthereum()

                    act(() => {
                        useAccountsStore
                            .getState()
                            .setAccounts([ALGORAND_ACCOUNT])
                    })

                    await waitFor(() => {
                        expect(emitted(walletKit)).toEqual([
                            {
                                topic: V2_SESSION_TOPIC,
                                event: { name: 'accountsChanged', data: [] },
                                chainId: ETH_MAINNET,
                            },
                        ])
                    })
                })
            })
        })
    })

    describe('with Ethereum dappConnect switched off', () => {
        beforeEach(() => {
            setCapabilityOverrides({ dappConnect: false }, 'ethereum')
        })

        it('Given a proposal requiring eip155, when it arrives, then it is rejected and no sheet opens', async () => {
            await mountProvider()
            const walletKit = await propose(
                eip155Namespace('requiredNamespaces'),
            )

            await waitFor(() => {
                expect(walletKit.rejectSession).toHaveBeenCalledTimes(1)
            })
            expect(walletKit.rejectSession).toHaveBeenCalledWith(
                expect.objectContaining({
                    reason: expect.objectContaining({ code: 5104 }),
                }),
            )
            expect(findButton('common.connect.label')).toBeUndefined()
        })

        it('Given algorand required and eip155 optional, when the sheet opens, then only the Algorand account is listed and the session settles algorand only', async () => {
            await mountProvider()
            const walletKit = await propose({
                requiredNamespaces: {
                    algorand: bothRequired().requiredNamespaces.algorand,
                },
                ...eip155Namespace('optionalNamespaces'),
            })

            await selectRows(ALGORAND_ACCOUNT)
            expect(screen.queryByText('Ether')).toBeNull()
            await connect(walletKit)

            expect(Object.keys(approvedNamespaces(walletKit))).toEqual([
                'algorand',
            ])
        })
    })
})
