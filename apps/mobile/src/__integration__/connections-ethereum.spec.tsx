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
import * as Clipboard from 'expo-clipboard'
import { Notifier } from 'react-native-notifier'
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
import { SENDER } from '@packages/chain-ethereum/src/__tests__/testing'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
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
    EvmRpcErrorFixture,
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

// The integration harness has no i18next instance, so <Trans> renders nothing;
// echoing its components lets the specs read the amounts it embeds.
vi.mock('react-i18next', async importOriginal => ({
    ...(await importOriginal<typeof import('react-i18next')>()),
    Trans: ({ components }: { components?: React.ReactNode[] }) => (
        <>{components}</>
    ),
}))

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
                ? { mainnet: ['https://mainnet.rpc.test/'] }
                : chainId === 'base'
                  ? { mainnet: ['https://base.rpc.test/'] }
                  : actual.chainEndpointsFor(chainId),
        config: {
            ...actual.config,
            reownProjectId: 'integration-project-id',
            chains: {
                enabled: ['algorand', 'ethereum', 'base'],
                capabilities: {},
            },
        },
    }
})

// Hardhat #0, the key the batch's fixture signatures were made with: the
// planner refuses a signature that doesn't recover to the sender.
const CHECKSUMMED_ETH_ADDRESS = SENDER
const STORED_ETH_ADDRESS = SENDER.toLowerCase()
const ETH_MAINNET = 'eip155:1'
const BASE_MAINNET = 'eip155:8453'

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
        base: { address: STORED_ETH_ADDRESS, keyPairId: 'eth-key' },
    },
    name: 'Ether',
}

const ETHEREUM_METHODS = [
    'eth_sendTransaction',
    'personal_sign',
    'eth_signTypedData_v4',
    'eth_signTypedData',
    'wallet_switchEthereumChain',
    'wallet_sendCalls',
    'eth_accounts',
    'eth_requestAccounts',
    'eth_chainId',
    'wallet_getCapabilities',
    'wallet_getCallsStatus',
    'wallet_showCallsStatus',
    'eth_sign',
    'eth_signTypedData_v3',
    'eth_signTransaction',
    'eth_sendRawTransaction',
    'wallet_getPermissions',
]

const IN_APP_ORIGIN: ConnectionOrigin = { source: 'in-app' }

const captured: { registry: Optional<ConnectionRegistryClient> } = {
    registry: undefined,
}
const RegistryProbe = () => {
    captured.registry = useConnectionRegistry()
    return null
}

const toastBodies = (): string[] =>
    vi
        .mocked(Notifier.showNotification)
        .mock.calls.map(([notification]) => String(notification.description))

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
        vi.mocked(Notifier.showNotification).mockClear()
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
            setCapabilityOverrides({ dappConnect: true }, 'base')
        })

        it('Given an eip155-only proposal, when the sheet opens, then only the Ethereum account is listed and Connect approves its checksummed address', async () => {
            await mountProvider()
            // The approved methods are the requested ones the wallet lists, so
            // the dApp asks for the whole set and two Pera never lists.
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
                            'wallet_addEthereumChain',
                            'wallet_watchAsset',
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

        it('Given an eip155 proposal, when the sheet opens, then it names the network, shows the account by its 0x address and lists the permissions in plain terms', async () => {
            await mountProvider()
            await propose({
                requiredNamespaces: {
                    eip155: {
                        chains: [ETH_MAINNET],
                        methods: ETHEREUM_METHODS,
                        events: [],
                    },
                },
            })

            await selectRows(ETHEREUM_ACCOUNT)

            expect(
                screen.getByText('walletconnect.request.title_network'),
            ).toBeTruthy()
            expect(
                screen.getByTestId('wc_requested_network_ethereum'),
            ).toBeTruthy()
            expect(
                screen.queryByText('walletconnect.request.network_not_added'),
            ).toBeNull()
            expect(
                screen.getByText(
                    addressCodecs.get('ethereum').truncate(STORED_ETH_ADDRESS),
                ),
            ).toBeTruthy()
            expect(screen.queryByText('Trading')).toBeNull()
            for (const key of [
                'view_accounts',
                'approve_transactions',
                'sign_messages',
                'switch_networks',
            ]) {
                expect(
                    screen.getByText(`walletconnect.permissions.${key}`),
                ).toBeTruthy()
            }
        })

        it('Given a wallet whose only account is an Algo25 account, when an eip155 proposal opens, then the network reads as not added with no way to add it', async () => {
            useAccountsStore.getState().setAccounts([ALGORAND_ACCOUNT])
            await mountProvider()
            await propose(eip155Namespace('requiredNamespaces'))

            await waitFor(() =>
                expect(
                    screen.getByTestId('wc_requested_network_ethereum'),
                ).toBeTruthy(),
            )
            expect(
                screen.getByText('walletconnect.request.network_not_added'),
            ).toBeTruthy()
            expect(screen.queryByTestId('wc_add_network_ethereum')).toBeNull()
            expect(screen.queryByText('Trading')).toBeNull()
        })

        it('Given an HD account that has not added Ethereum, when an eip155 proposal opens, then the network reads as not added and offers adding it', async () => {
            useAccountsStore.getState().setAccounts([
                {
                    ...ETHEREUM_ACCOUNT,
                    id: 'eth-conn-hd-algo-only',
                    chains: {
                        algorand: {
                            address: HD_TEST_ADDRESS,
                            keyPairId: 'hd-algo-key',
                        },
                    },
                },
            ])
            await mountProvider()
            await propose(eip155Namespace('requiredNamespaces'))

            await waitFor(() =>
                expect(
                    screen.getByTestId('wc_add_network_ethereum'),
                ).toBeTruthy(),
            )
            expect(
                screen.getByText('walletconnect.request.network_not_added'),
            ).toBeTruthy()
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

        it('Given a proposal requiring eth_sign and eth_signTypedData_v3, when the user connects, then the session lists both but Settings grants only eth_sendTransaction, and calls to them, eth_signTransaction, eth_sendRawTransaction, wallet_getPermissions and the unlisted wallet_addEthereumChain are answered 4200 without a review while eth_chainId is answered', async () => {
            await mountProvider()
            const walletKit = await propose({
                requiredNamespaces: {
                    eip155: {
                        chains: [ETH_MAINNET],
                        methods: [
                            'eth_sendTransaction',
                            'eth_sign',
                            'eth_signTypedData_v3',
                        ],
                        events: [],
                    },
                },
            })
            await selectRows(ETHEREUM_ACCOUNT)
            await connect(walletKit)

            expect(approvedNamespaces(walletKit).eip155.methods).toEqual([
                'eth_sendTransaction',
                'eth_sign',
                'eth_signTypedData_v3',
            ])
            // What Settings lists as granted: never the refused eth_sign.
            const record =
                await getProvider().connections.store.get(V2_SESSION_TOPIC)
            expect(captured.registry!.methodsFor(record!)).toEqual([
                'eth_sendTransaction',
            ])
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
            send(1, 'eth_sign')
            send(2, 'eth_signTypedData_v3')
            send(3, 'eth_signTransaction')
            send(4, 'eth_sendRawTransaction')
            send(5, 'wallet_getPermissions')
            send(6, 'wallet_addEthereumChain')
            send(7, 'eth_chainId')

            await waitFor(() => {
                expect(walletKit.respondSessionRequest).toHaveBeenCalledTimes(7)
            })
            const answers = new Map(
                (walletKit.respondSessionRequest as Mock).mock.calls.map(
                    ([{ response }]) => [response.id, response],
                ),
            )
            for (const id of [1, 2, 3, 4, 5, 6]) {
                expect(answers.get(id)).toMatchObject({
                    error: { code: 4200 },
                })
            }
            expect(answers.get(7)).toMatchObject({ result: '0x1' })
            expect(pendingSignRequests()).toHaveLength(0)
            // The user hears about the refused methods, not the unprompted
            // wallet_getPermissions probe.
            await waitFor(() => {
                expect(
                    toastBodies().filter(
                        body =>
                            body ===
                            'errors.walletconnect.unsupported_method_body',
                    ),
                ).toHaveLength(5)
            })
        })

        describe('a proposal naming several EVM chains', () => {
            const SWITCH_CONFIRM = 'walletconnect.switch_network.confirm'

            it('Given Ethereum, Base and a chain Pera lacks, when the user connects, then one eip155 namespace carries both served mainnets', async () => {
                await mountProvider()
                const walletKit = await propose({
                    requiredNamespaces: {},
                    optionalNamespaces: {
                        eip155: {
                            chains: [ETH_MAINNET, BASE_MAINNET, 'eip155:130'],
                            methods: ['eth_sendTransaction'],
                            events: [],
                        },
                    },
                })
                await selectRows(ETHEREUM_ACCOUNT)
                await connect(walletKit)

                const { eip155 } = approvedNamespaces(walletKit)
                expect(eip155.chains).toEqual([ETH_MAINNET, BASE_MAINNET])
                expect(eip155.accounts).toEqual([
                    `${ETH_MAINNET}:${CHECKSUMMED_ETH_ADDRESS}`,
                    `${BASE_MAINNET}:${CHECKSUMMED_ETH_ADDRESS}`,
                ])
            })

            it('Given a session that holds only Base, when the dApp asks from Base to switch to Ethereum, then the user is asked and allowing it adds the network', async () => {
                await mountProvider()
                const walletKit = await propose({
                    requiredNamespaces: {
                        eip155: {
                            chains: [BASE_MAINNET],
                            methods: [
                                'eth_sendTransaction',
                                'wallet_switchEthereumChain',
                            ],
                            events: [],
                        },
                    },
                })
                await selectRows(ETHEREUM_ACCOUNT)
                await connect(walletKit)

                act(() => {
                    walletKit.emit(
                        'session_request',
                        makeRequest({
                            id: 41,
                            method: 'wallet_switchEthereumChain',
                            params: [{ chainId: '0x1' }],
                            chainId: BASE_MAINNET,
                        }),
                    )
                })
                await waitFor(() => {
                    expect(findButton(SWITCH_CONFIRM)).toBeTruthy()
                })
                expect(walletKit.updateSession).not.toHaveBeenCalled()

                fireEvent.click(findButton(SWITCH_CONFIRM)!)

                await waitFor(() => {
                    expect(
                        walletKit.respondSessionRequest,
                    ).toHaveBeenCalledWith({
                        topic: V2_SESSION_TOPIC,
                        response: { id: 41, jsonrpc: '2.0', result: null },
                    })
                })
                const { namespaces } = (walletKit.updateSession as Mock).mock
                    .calls[0][0]
                expect(namespaces.eip155.chains).toEqual([
                    BASE_MAINNET,
                    ETH_MAINNET,
                ])
            })
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
                chainId = ETH_MAINNET,
            ) =>
                act(() => {
                    walletKit.emit(
                        'session_request',
                        makeRequest({
                            id: 7,
                            method: 'eth_sendTransaction',
                            params: [transaction],
                            chainId,
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

            it('Given messageSigning is off for Ethereum, when a valid request is approved with a submitted hash, then the dApp still receives that hash', async () => {
                setCapabilityOverrides(
                    { dappConnect: true, messageSigning: false },
                    'ethereum',
                )
                const walletKit = await settle()

                sendTransaction(walletKit, {
                    from: CHECKSUMMED_ETH_ADDRESS,
                    to: RECIPIENT,
                    value: '0x1',
                    gasPrice: '0x3b9aca00',
                })
                const request = await queued()
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

            it('Given a valid request, when it is queued, then the review is titled for one transaction and shows the fee estimate and max fee', async () => {
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
                    screen.getAllByTestId('ethereum_review_fee'),
                ).not.toHaveLength(0)
                expect(
                    screen.getAllByTestId('fee_summary_estimate'),
                ).not.toHaveLength(0)
                expect(
                    screen.getAllByTestId('fee_summary_max'),
                ).not.toHaveLength(0)
                expect(
                    screen.getAllByText('signing.transactions.title_one'),
                ).not.toHaveLength(0)
                expect(
                    screen.queryByText(
                        'signing.transaction_view.invalid_title',
                    ),
                ).toBeNull()
            })

            it('Given a call to a contract Pera cannot read, when it is queued, then its review leaves the raw call to View details, which shows it with its pricing and returns to the review', async () => {
                const walletKit = await settle()
                renderSignReview()
                const data = `0x3593564c${'0'.repeat(63)}1${'0'.repeat(64)}`

                sendTransaction(walletKit, {
                    from: CHECKSUMMED_ETH_ADDRESS,
                    to: RECIPIENT,
                    value: '0x1',
                    data,
                })
                await queued()

                await waitFor(
                    () => {
                        expect(
                            screen.getAllByTestId(
                                'ethereum_contract_call_warning',
                            ),
                        ).not.toHaveLength(0)
                    },
                    { timeout: 5000 },
                )
                expect(
                    screen.queryByTestId('ethereum_contract_call_advanced'),
                ).toBeNull()
                expect(
                    screen.queryByTestId('ethereum_contract_call_data'),
                ).toBeNull()
                const fee = screen.getAllByTestId('ethereum_review_fee')[0]
                const target = screen.getAllByTestId(
                    'ethereum_contract_call_to',
                )[0]
                const viewDetails = screen.getAllByTestId(
                    'ethereum_view_details',
                )[0]
                expect(
                    target.compareDocumentPosition(viewDetails) &
                        Node.DOCUMENT_POSITION_FOLLOWING,
                ).toBeTruthy()
                expect(
                    viewDetails.compareDocumentPosition(fee) &
                        Node.DOCUMENT_POSITION_FOLLOWING,
                ).toBeTruthy()

                fireEvent.click(
                    screen.getAllByTestId('ethereum_view_details')[0],
                )

                await waitFor(() => {
                    expect(
                        screen.getAllByTestId('transaction_details_screen'),
                    ).not.toHaveLength(0)
                })
                expect(
                    screen.getAllByTestId('ethereum_contract_call_selector')[0]
                        .textContent,
                ).toContain('0x3593564c')
                fireEvent.click(screen.getAllByText('common.show_more')[0])
                expect(
                    screen.getAllByTestId('ethereum_contract_call_data')[0]
                        .textContent,
                ).toContain(data)

                vi.mocked(Clipboard.setStringAsync).mockClear()
                fireEvent.click(
                    screen.getAllByTestId(
                        'ethereum_contract_call_data_copy',
                    )[0],
                )
                expect(Clipboard.setStringAsync).toHaveBeenCalledWith(data)
                for (const testID of [
                    'ethereum_nonce',
                    'ethereum_gas_limit',
                    'ethereum_max_fee_per_gas',
                    'ethereum_max_priority_fee_per_gas',
                ]) {
                    expect(screen.getAllByTestId(testID)).not.toHaveLength(0)
                }

                fireEvent.click(
                    screen.getAllByTestId('navigation_back_button')[0],
                )

                await waitFor(() => {
                    expect(
                        screen.queryByTestId('transaction_details_screen'),
                    ).toBeNull()
                })
                expect(
                    screen.getAllByTestId('ethereum_contract_call_warning'),
                ).not.toHaveLength(0)
                expect(
                    screen.getAllByTestId('signing-confirm-slide'),
                ).not.toHaveLength(0)
                expect(
                    isElementDisabled(
                        screen.getAllByTestId('signing-confirm-slide')[0],
                    ),
                ).toBe(false)
            })

            it("Given a dApp's gas limit far above what the call needs, when it is queued, then the review warns of the high fee", async () => {
                const walletKit = await settle()
                renderSignReview()

                sendTransaction(walletKit, {
                    from: CHECKSUMMED_ETH_ADDRESS,
                    to: RECIPIENT,
                    value: '0x1',
                    gas: '0x989680',
                })
                await queued()

                await waitFor(
                    () => {
                        expect(
                            screen.getAllByTestId('ethereum_high_fee_warning'),
                        ).not.toHaveLength(0)
                    },
                    { timeout: 5000 },
                )
                const maxFee = screen.getAllByTestId('fee_summary_max')[0]
                const warning = screen.getAllByTestId(
                    'ethereum_high_fee_body',
                )[0]
                expect(warning.textContent).toContain(maxFee.textContent)
                const slide = screen.getAllByTestId('signing-confirm-slide')[0]
                expect(isElementDisabled(slide)).toBe(true)

                fireEvent.click(
                    screen.getAllByTestId('review_warnings_acknowledge')[0],
                )

                await waitFor(() => {
                    expect(
                        isElementDisabled(
                            screen.getAllByTestId('signing-confirm-slide')[0],
                        ),
                    ).toBe(false)
                })
            })

            it('Given an unknown contract call with a gas limit far above what it needs, when it is queued, then both warnings fold into one banner', async () => {
                const walletKit = await settle()
                renderSignReview()

                sendTransaction(walletKit, {
                    from: CHECKSUMMED_ETH_ADDRESS,
                    to: RECIPIENT,
                    value: '0x1',
                    data: `0x3593564c${'0'.repeat(63)}1${'0'.repeat(64)}`,
                    gas: '0x989680',
                })
                await queued()

                await waitFor(
                    () => {
                        expect(
                            screen.getAllByTestId('review_warnings_summary'),
                        ).not.toHaveLength(0)
                    },
                    { timeout: 5000 },
                )
                fireEvent.click(
                    screen.getAllByTestId('review_warnings_toggle')[0],
                )
                for (const id of [
                    'ethereum_high_fee_warning',
                    'ethereum_contract_call_warning',
                ]) {
                    expect(screen.getAllByTestId(id)).not.toHaveLength(0)
                }
            })

            it('Given a call the node says would revert, when the dApp sends it with its own gas, then nothing is queued and the user is told why', async () => {
                const walletKit = await settle()
                server.use(
                    ...evmRpcHandlers({
                        responses: {
                            eth_estimateGas: new EvmRpcErrorFixture(
                                3,
                                'execution reverted: ERC20: transfer amount exceeds balance',
                            ),
                        },
                    }),
                )

                sendTransaction(walletKit, {
                    from: CHECKSUMMED_ETH_ADDRESS,
                    to: RECIPIENT,
                    value: '0x0',
                    data: '0xa9059cbb',
                    gas: '0x30d40',
                })

                await waitFor(() => {
                    expect(answerOf(walletKit)).toHaveProperty('error')
                })
                expect(pendingSignRequests()).toHaveLength(0)
                await waitFor(() => {
                    expect(toastBodies()).toContain(
                        'errors.evm.reverted_with_reason.body',
                    )
                })
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

            describe('on a second EVM chain', () => {
                const settleOnBase = async () => {
                    server.use(...evmRpcHandlers())
                    await mountProvider()
                    const walletKit = await propose({
                        requiredNamespaces: {
                            eip155: {
                                chains: [BASE_MAINNET],
                                methods: ['eth_sendTransaction'],
                                events: [],
                            },
                        },
                    })
                    await selectRows(ETHEREUM_ACCOUNT)
                    await connect(walletKit)
                    return walletKit
                }

                it('Given a session on Base, when a request arrives on Base and is approved, then it is reviewed as a Base transaction and the dApp receives the hash', async () => {
                    const walletKit = await settleOnBase()
                    renderSignReview()

                    sendTransaction(
                        walletKit,
                        {
                            from: CHECKSUMMED_ETH_ADDRESS,
                            to: RECIPIENT,
                            value: '0x1',
                            gasPrice: '0x3b9aca00',
                        },
                        BASE_MAINNET,
                    )
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

                it('Given a queued Base request, when the user rejects it, then the dApp receives 4001', async () => {
                    const walletKit = await settleOnBase()
                    sendTransaction(
                        walletKit,
                        { from: CHECKSUMMED_ETH_ADDRESS, to: RECIPIENT },
                        BASE_MAINNET,
                    )
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
            })

            describe("a dApp's standard token call", () => {
                const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
                const SPENDER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
                // approve(SPENDER, 2^256-1)
                const APPROVE_DATA = `0x095ea7b3${SPENDER.slice(2).toLowerCase().padStart(64, '0')}${'f'.repeat(64)}`
                // transfer(SPENDER, 5_000_000)
                const TRANSFER_DATA = `0xa9059cbb${SPENDER.slice(2).toLowerCase().padStart(64, '0')}${(5_000_000).toString(16).padStart(64, '0')}`

                const reviewCall = async (data: string = APPROVE_DATA) => {
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
                        data,
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

                it('Given the shipped Ethereum capabilities, when a dApp approves a spender for unlimited USDC, then it reads as an approval with the unlimited warning and approving it answers the dApp', async () => {
                    const { walletKit, request } = await reviewCall()

                    await waitFor(() => {
                        expect(
                            screen.getAllByTestId(
                                'message-signing-spend-approval-warning',
                            ),
                        ).not.toHaveLength(0)
                    })
                    expect(
                        screen.getAllByText(
                            /^signing\.spend_approval\.allow_title/,
                        ),
                    ).not.toHaveLength(0)
                    expect(
                        screen.getAllByText('signing.spend_approval.unlimited'),
                    ).not.toHaveLength(0)
                    await waitFor(() => {
                        expect(screen.getAllByText('USDC')).not.toHaveLength(0)
                    })
                    expect(
                        screen.queryByTestId('ethereum_contract_call_warning'),
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

                it('Given the shipped Ethereum capabilities, when a dApp sends a standard token transfer, then it stays an unrecognised contract call with the unknown-contract notice', async () => {
                    await reviewCall(TRANSFER_DATA)

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
                })
            })

            describe('a call to a known contract, with contractDecoding on', () => {
                const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
                // The Universal Router version the Uniswap app sent QA's swap to.
                const ROUTER = '0x23617e59A5925b2A4Bf75d73ff6711cD0b29De85'
                // execute(0x00, [V3_SWAP_EXACT_IN: 2.5 USDC for at least 2.4 DAI, paid to the signer], deadline)
                const SWAP_DATA =
                    '0x3593564c000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000f486570000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000100000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb9226600000000000000000000000000000000000000000000000000000000002625a0000000000000000000000000000000000000000000000000214e8348c4f0000000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002ba0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000646b175474e89094c44da98b954eedeac495271d0f000000000000000000000000000000000000000000'
                // execute(0x000604, [V3_SWAP_EXACT_IN: 2.5 USDC for 2.4 DAI into the router, PAY_PORTION of all 10 000 bips of the DAI to a stranger, SWEEP of the DAI to the signer with a minimum of 1], deadline)
                const HOSTILE_FEE_SWAP_DATA =
                    '0x3593564c000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000f48657000000000000000000000000000000000000000000000000000000000000000003000604000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000002625a0000000000000000000000000000000000000000000000000214e8348c4f0000000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002ba0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000646b175474e89094c44da98b954eedeac495271d0f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000006b175474e89094c44da98b954eedeac495271d0f00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000600000000000000000000000006b175474e89094c44da98b954eedeac495271d0f000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb922660000000000000000000000000000000000000000000000000000000000000001'
                const FEE_RECIPIENT =
                    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
                // execute(0x10, [0x], deadline): V4_SWAP, a command the decoder doesn't read
                const UNKNOWN_COMMAND_DATA =
                    '0x3593564c000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000f486570000000000000000000000000000000000000000000000000000000000000000011000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000'

                const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
                const AAVE_POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'
                // deposit()
                const DEPOSIT_DATA = '0xd0e30db0'
                // supply(USDC, 3_000_000, signer, 0)
                const SUPPLY_DATA =
                    '0x617ba037000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4800000000000000000000000000000000000000000000000000000000002dc6c0000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb922660000000000000000000000000000000000000000000000000000000000000000'

                beforeEach(() => {
                    setCapabilityOverrides(
                        { dappConnect: true, contractDecoding: true },
                        'ethereum',
                    )
                })

                const reviewKnownCall = async (
                    to: string,
                    data: string,
                    value = '0x0',
                ) => {
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
                        to,
                        value,
                        data,
                    })
                    await queued()
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
                }

                const reviewRouterCall = (data: string) =>
                    reviewKnownCall(ROUTER, data)

                it('Given a Universal Router swap, when it is reviewed, then it is titled Swap with the labelled router, what is paid and the least received, and no unknown-contract notice', async () => {
                    await reviewRouterCall(SWAP_DATA)

                    await waitFor(() => {
                        expect(
                            screen.getAllByTestId('ethereum_action_receive'),
                        ).not.toHaveLength(0)
                    })
                    expect(
                        screen.getAllByText('transactions.list_item.swap'),
                    ).not.toHaveLength(0)
                    expect(
                        screen.getAllByTestId('ethereum_known_contract'),
                    ).not.toHaveLength(0)
                    expect(
                        screen.getAllByText('Uniswap Universal Router'),
                    ).not.toHaveLength(0)
                    expect(
                        screen.getAllByTestId(
                            'ethereum_known_contract_verified',
                        ),
                    ).not.toHaveLength(0)
                    expect(
                        screen.getAllByTestId('ethereum_action_pay'),
                    ).not.toHaveLength(0)
                    // A token's record names it however the token likes, so
                    // its address is shown whether or not the record is known.
                    expect(
                        screen.getAllByTestId('ethereum_action_pay_token'),
                    ).not.toHaveLength(0)
                    expect(
                        screen.getAllByTestId('ethereum_action_receive_token'),
                    ).not.toHaveLength(0)
                    expect(
                        screen.getAllByText(
                            'ethereum.contract_action.receive_at_least',
                        ),
                    ).not.toHaveLength(0)
                    expect(
                        screen.queryByTestId('ethereum_contract_call_warning'),
                    ).toBeNull()
                })

                it('Given a swap that pays a stranger its whole output, when it is reviewed, then it stays a Swap but shows the fee with its recipient and keeps the unknown-contract notice', async () => {
                    await reviewRouterCall(HOSTILE_FEE_SWAP_DATA)

                    await waitFor(() => {
                        expect(
                            screen.getAllByTestId('ethereum_action_fee_0'),
                        ).not.toHaveLength(0)
                    })
                    expect(
                        screen.getAllByText('transactions.list_item.swap'),
                    ).not.toHaveLength(0)
                    expect(
                        screen.getAllByText('ethereum.contract_action.fee'),
                    ).not.toHaveLength(0)
                    expect(
                        screen.getAllByText(
                            'ethereum.contract_action.fee_share',
                        ),
                    ).not.toHaveLength(0)
                    expect(
                        screen.getAllByTestId('ethereum_action_fee_0_token'),
                    ).not.toHaveLength(0)
                    expect(
                        screen.getAllByTestId(
                            'ethereum_action_fee_0_recipient',
                        ),
                    ).not.toHaveLength(0)
                    expect(
                        screen.getAllByText(
                            `${FEE_RECIPIENT.slice(0, 6)}...${FEE_RECIPIENT.slice(-4)}`,
                        ),
                    ).not.toHaveLength(0)
                    expect(
                        screen.getAllByTestId('ethereum_contract_call_warning'),
                    ).not.toHaveLength(0)
                    expect(
                        screen.getAllByText(
                            'ethereum.contract_action.receive_at_least',
                        ),
                    ).not.toHaveLength(0)
                })

                it('Given a swap whose token it has no record of, when it is reviewed, then the amount is labelled as base units', async () => {
                    await reviewRouterCall(SWAP_DATA)

                    await waitFor(() => {
                        expect(
                            screen.getAllByTestId('ethereum_action_receive'),
                        ).not.toHaveLength(0)
                    })
                    // DAI has no record here, so its leg is raw base units and says so.
                    await waitFor(() => {
                        expect(
                            screen.getAllByTestId('ethereum_action_base_units'),
                        ).not.toHaveLength(0)
                    })
                    expect(
                        screen.getAllByText(
                            'ethereum.contract_action.base_units',
                        ),
                    ).not.toHaveLength(0)
                })

                it('Given a WETH deposit, when it is reviewed, then it is titled Wrap with the wrapped amount and the labelled token', async () => {
                    await reviewKnownCall(
                        WETH,
                        DEPOSIT_DATA,
                        '0x2386f26fc10000',
                    )

                    await waitFor(() => {
                        expect(
                            screen.getAllByTestId('ethereum_action_amount'),
                        ).not.toHaveLength(0)
                    })
                    expect(
                        screen.getAllByText('transactions.list_item.wrap'),
                    ).not.toHaveLength(0)
                    expect(
                        screen.getAllByText('Wrapped Ether'),
                    ).not.toHaveLength(0)
                    expect(
                        screen.queryByTestId('ethereum_contract_call_warning'),
                    ).toBeNull()
                })

                it('Given an Aave supply, when it is reviewed, then it is titled Supply with the labelled pool, the asset and the amount', async () => {
                    await reviewKnownCall(AAVE_POOL, SUPPLY_DATA)

                    await waitFor(() => {
                        expect(
                            screen.getAllByTestId('ethereum_action_asset'),
                        ).not.toHaveLength(0)
                    })
                    expect(
                        screen.getAllByText('transactions.list_item.supply'),
                    ).not.toHaveLength(0)
                    expect(
                        screen.getAllByText('Aave V3 Pool'),
                    ).not.toHaveLength(0)
                    expect(
                        screen.getAllByTestId('ethereum_action_amount'),
                    ).not.toHaveLength(0)
                    await waitFor(() => {
                        expect(screen.getAllByText('USDC')).not.toHaveLength(0)
                    })
                    expect(
                        screen.queryByTestId('ethereum_contract_call_warning'),
                    ).toBeNull()
                })

                it('Given a router call with a command it cannot read, when it is reviewed, then it is a labelled Contract Call with the unknown-contract notice, not a Swap', async () => {
                    await reviewRouterCall(UNKNOWN_COMMAND_DATA)

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
                        screen.getAllByText('Uniswap Universal Router'),
                    ).not.toHaveLength(0)
                    expect(
                        screen.queryByText('transactions.list_item.swap'),
                    ).toBeNull()
                    expect(
                        screen.queryByTestId('ethereum_action_pay'),
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

            // Ethereum keys never exist in JS, so the KMS answers with
            // signatures Hardhat #0 made over these exact digests, in its
            // r‖s‖recovery encoding. The node fixture (nonce from `sent`, the
            // default gas and fees) makes each build deterministic; a digest
            // missing here means the build changed and its signature must be
            // regenerated.
            const SENDER_SIGNATURES: Record<string, string> = {
                // SWAP at nonce 1.
                '145988f3f10f6fac76917939006b17d3460372b96d47350ba72e69f4dd2dcc68':
                    'a7240ade3fd0663e4a0dc33976a0a99576f7c64e686ecfd2f2da62e193188409468137b6c8a7ec9887de6c02770043de07f754c7b5ad17de62364e12e36366e901',
                // APPROVE at nonce 0.
                a37173bd12f3eb7ec722ba91dacb4933093091ec5d3a19aaf97f622528ac4ae9:
                    'c7e7c9d3cfd73161421bf7c282fe2e2d3e371ec94a390f57fa0a3bd52201d8e74feba4497b3442e8d4c2418b1e3c3e0c36699697f3b81e40a06ab6c1df602d9100',
            }

            const signWithSenderKey = async (
                _keyPairId: string,
                digest: Uint8Array,
            ) => {
                const hex = Buffer.from(digest).toString('hex')
                const signature = SENDER_SIGNATURES[hex]
                if (!signature) {
                    throw new Error(`No fixture signature for digest ${hex}`)
                }
                return Uint8Array.from(Buffer.from(signature, 'hex'))
            }

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
                vi.spyOn(kmsCore, 'sign').mockImplementation(signWithSenderKey)
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

            it('Given an approve-then-swap batch, when it is queued, then the review keeps the plural title', async () => {
                const walletKit = await settle()
                renderSignReview()

                sendCalls(walletKit)

                await waitFor(
                    () => {
                        expect(
                            screen.getAllByText('signing.transactions.title'),
                        ).not.toHaveLength(0)
                    },
                    { timeout: 5000 },
                )
                expect(
                    screen.queryByText('signing.transactions.title_one'),
                ).toBeNull()
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
                    await waitFor(() => {
                        expect(toastBodies()).toContain(
                            'errors.walletconnect.unsupported_network_body',
                        )
                    })
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

                it('Given the wallet in developer mode, when a dApp naming mainnet first connects, then it hears chainChanged for Sepolia and nothing tells the user', async () => {
                    act(() => {
                        useNetworkStore.getState().setMode('developer')
                    })
                    const walletKit = await settleEthereum([
                        ETH_MAINNET,
                        ETH_SEPOLIA,
                    ])

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

                    emitRequest(walletKit, {
                        id: 35,
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: '0x1' }],
                        chainId: ETH_MAINNET,
                    })
                    emitRequest(walletKit, {
                        id: 36,
                        method: 'eth_chainId',
                        params: [],
                        chainId: ETH_MAINNET,
                    })

                    await waitFor(() => {
                        expect(
                            walletKit.respondSessionRequest,
                        ).toHaveBeenCalledTimes(2)
                    })
                    const sent = answers(walletKit)
                    expect(sent.get(35)).toMatchObject({
                        error: { code: 4901 },
                    })
                    expect(sent.get(36)).toMatchObject({
                        error: { code: 4901 },
                    })
                    expect(toastBodies()).toEqual([])
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
            setCapabilityOverrides({ dappConnect: false }, 'base')
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
