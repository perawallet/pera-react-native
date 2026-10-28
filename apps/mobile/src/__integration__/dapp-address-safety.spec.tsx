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

// A dApp over WalletConnect v2 asks to sign something naming an address on the
// device's scam-address list, or one imitating an address the user knows. The
// lists are seeded from a fixture snapshot into the real database, and the
// review is the real sign sheet with only `@reown/walletkit` stubbed.

import React, { useEffect, useRef } from 'react'
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type MockInstance,
} from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { onlineManager } from '@tanstack/react-query'
import {
    ensurePhishingListsSeeded,
    usePhishingListStore,
    type PhishingListSnapshot,
} from '@perawallet/wallet-core-site-safety'
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
import { evmRpcHandlers } from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import {
    resetConnectionPairingStateForTesting,
    useConnectionRegistry,
    type ConnectionRegistryClient,
} from '@perawallet/wallet-core-connections'
import { useContactsStore } from '@perawallet/wallet-core-contacts'
import { kmsCore } from '@perawallet/wallet-core-kms'
import { nativeAssetFor, upsertAssets } from '@perawallet/wallet-core-assets'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { encodeToBase64, type Optional } from '@perawallet/wallet-core-shared'
import type { ConnectionOrigin } from '@perawallet/wallet-extension-connections'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    DAI_PERMIT_TYPED_DATA,
    PERMIT2_SINGLE_NO_DEADLINE_TYPED_DATA,
    PERMIT2_SINGLE_UNLIMITED_TYPED_DATA,
    SENDER,
    SIGNER_KEY_PAIR_ID,
    vectorSignature,
} from '@packages/chain-ethereum/src/__tests__/testing'
import {
    makeProposal,
    makeRequest,
    MAINNET_CHAIN_ID,
    TOPIC as V2_SESSION_TOPIC,
    V2_URI,
} from '@packages/walletconnect/src/v2/__tests__/fakeWalletKit'
import { useSigningStore } from '@packages/signing/src/store'
import { __resetSigningActorRegistryForTests } from '@packages/signing/src/hooks/useSigningActorLifecycle'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { server, setSuiteUnhandledRequestMode } from '@test-utils/msw-server'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    buildPaymentTransaction,
    seedAlgo25Signer,
} from '@test-utils/signing-review'
import { walletKitStub, type FakeWalletKit } from '@test-utils/walletkit-stub'
import { getAllPressables, isElementDisabled } from '@test-utils/rnw'
import { ConnectionsProvider } from '@modules/connections/shell'
import { SigningOverlays } from '@modules/signing/shell'
import { addressOf } from './__fixtures__/accounts'
import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'

vi.unmock('@perawallet/wallet-core-site-safety')

// The integration setup registers whichever chains config enables, v2 builds
// no client without a Reown project id, and a built request prices on the
// selected network's node, which the test build has no URL for.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
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

const ETH_MAINNET = 'eip155:1'
const RPC_HOST = 'mainnet.rpc.test'

// Hardhat #1, the Permit2 fixture's spender: here a listed drainer.
const DRAINER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const UNLISTED_CONTRACT = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'
// approve(DRAINER, 2^256-1)
const APPROVE_DRAINER_DATA = `0x095ea7b3${DRAINER.slice(2).toLowerCase().padStart(64, '0')}${'f'.repeat(64)}`

const CONTACT = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
// Same `0x1234...abcd` short form as the contact, different middle.
const CONTACT_LOOK_ALIKE =
    `${CONTACT.slice(0, 6)}${'5'.repeat(32)}${CONTACT.slice(-4)}`.toLowerCase()

// A pair the Algorand codec reads as alike: same first and last characters.
const SAVINGS = '2SSSXMFNG55PKDGKJB7MLTGIRSIYAXFCJAWSQFD6C3M7L6JLG5NJIBTGAA'
const SAVINGS_LOOK_ALIKE =
    '2SSSXMBXVWYMJ33BCFI5PED5O7LMFJZWXXSAJCU44W5M4NP4Q5YIJBTGAA'

const listOf = (addresses: string) => ({
    deny: '',
    allow: '',
    impersonationTargets: '',
    addresses,
})

const SNAPSHOT: PhishingListSnapshot = {
    generatedAt: '2026-01-01T00:00:00.000Z',
    sources: {
        metamask: listOf(''),
        polkadot: { ...listOf(''), deny: 'bundled-dot.example' },
        'mew-darklist': listOf(DRAINER.toLowerCase()),
    },
}

const ETHEREUM_ACCOUNT: WalletAccount = {
    id: 'eth-address-safety',
    custody: {
        kind: 'local',
        seed: 'bip39',
        hd: { account: 0, keyIndex: 0 },
    },
    chains: { ethereum: { address: SENDER, keyPairId: SIGNER_KEY_PAIR_ID } },
    name: 'Ether',
}

const SAVINGS_ACCOUNT: WalletAccount = {
    id: 'algo-savings',
    custody: { kind: 'watch' },
    chains: { algorand: { address: SAVINGS } },
    name: 'Savings',
}

const IN_APP_ORIGIN: ConnectionOrigin = { source: 'in-app' }

const LISTED = 'request_address_listed_0'
const LISTED_BADGE = 'request_address_listed_badge_0'
const LOOK_ALIKE = 'request_address_look_alike_0'
const LOOK_ALIKE_KNOWN = 'request_address_look_alike_known_0'
const ACKNOWLEDGE = 'request_address_acknowledge'
const WARNING = 'request_address_warning'
const TRANSACTION_SLIDE = 'signing-confirm-slide'
const MESSAGE_SLIDE = 'message-signing-confirm-slide'

const captured: { registry: Optional<ConnectionRegistryClient> } = {
    registry: undefined,
}
const RegistryProbe = () => {
    captured.registry = useConnectionRegistry()
    return null
}

// The once-per-device request FAQ is pre-acknowledged so it cannot open a
// competing sheet.
const ConnectionsWithSigning = () => {
    const { setPreference } = usePreferences()
    const acknowledged = useRef(false)
    useEffect(() => {
        if (acknowledged.current) return
        acknowledged.current = true
        setPreference('hasSeenTransactionRequestFAQ', true)
    }, [setPreference])

    return (
        <ConnectionsProvider>
            <RegistryProbe />
            <SigningOverlays />
        </ConnectionsProvider>
    )
}

const findButton = (label: string): Optional<HTMLButtonElement> =>
    getAllPressables().find(button =>
        (button.textContent ?? '').includes(label),
    ) as Optional<HTMLButtonElement>

const waitForWalletKit = (): Promise<FakeWalletKit> =>
    waitFor(
        () => {
            const client = walletKitStub.last()
            if (!client) throw new Error('WalletKit was never initialised')
            return client
        },
        { timeout: 15_000 },
    )

const connectSession = async (
    namespaces: Parameters<typeof makeProposal>[0],
    accountId: string,
): Promise<FakeWalletKit> => {
    renderWithNavigation(ConnectionsWithSigning, 'ConnectionsWithSigning')
    await waitFor(() => expect(captured.registry).toBeTruthy())
    await act(async () => {
        await captured.registry!.pair(V2_URI, { origin: IN_APP_ORIGIN })
    })
    const walletKit = await waitForWalletKit()
    act(() => {
        walletKit.emit('session_proposal', makeProposal(namespaces))
    })
    await waitFor(() => expect(findButton('common.connect.label')).toBeTruthy())
    const row = `wc_account_row_${accountId}`
    await waitFor(() => expect(screen.getByTestId(row)).toBeTruthy(), {
        timeout: 5000,
    })
    fireEvent.click(screen.getByTestId(row))
    await waitFor(() =>
        expect(isElementDisabled(findButton('common.connect.label')!)).toBe(
            false,
        ),
    )
    fireEvent.click(findButton('common.connect.label')!)
    await waitFor(async () => {
        expect(
            await getProvider().connections.store.get(V2_SESSION_TOPIC),
        ).toBeTruthy()
    })
    return walletKit
}

const send = (
    walletKit: FakeWalletKit,
    method: string,
    params: unknown[],
    chainId = ETH_MAINNET,
) =>
    act(() => {
        walletKit.emit(
            'session_request',
            makeRequest({ id: 7, method, params, chainId }),
        )
    })

const findSlide = (testId: string) =>
    waitFor(() => screen.getByTestId(testId), { timeout: 15_000 })

const expectHeldUntilAcknowledged = async (slideTestId: string) => {
    await waitFor(() =>
        expect(isElementDisabled(screen.getByTestId(slideTestId))).toBe(true),
    )
    fireEvent.click(screen.getByTestId(ACKNOWLEDGE))
    await waitFor(() =>
        expect(isElementDisabled(screen.getByTestId(slideTestId))).toBe(false),
    )
}

// Every request the app makes, so a test can show no request address left the
// device for a lookup.
type SentRequest = { url: string; body: Promise<string> }
const sent: SentRequest[] = []
const recordRequest = ({ request }: { request: Request }) => {
    sent.push({ url: request.url, body: request.clone().text() })
}

// The chain's node reads the transaction to price it, and the review asks
// Pera for an Algorand address's NFD name to display it, as for any request.
// What must never happen is a request address going anywhere else.
const isDisplayOrChainRequest = (url: URL) =>
    url.host === RPC_HOST || url.pathname.endsWith('/accounts/names/bulk-read/')

const expectNotSentForLookup = async (addresses: string[]) => {
    for (const { url, body } of sent) {
        const lowerUrl = url.toLowerCase()
        for (const address of addresses) {
            const needle = address.toLowerCase().replace(/^0x/, '')
            expect(lowerUrl).not.toContain(needle)
            if (!isDisplayOrChainRequest(new URL(url))) {
                expect((await body).toLowerCase()).not.toContain(needle)
            }
        }
    }
}

describe('Flow: a dApp request names a scam address or a look-alike of a known one', () => {
    setSuiteUnhandledRequestMode('bypass')

    beforeAll(async () => {
        await setupTestDatabase()
        server.events.on('request:start', recordRequest)
    })
    afterAll(async () => {
        server.events.removeListener('request:start', recordRequest)
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        __resetSigningActorRegistryForTests()
        resetTestKeystore()
        walletKitStub.reset()
        captured.registry = undefined
        sent.length = 0
        usePhishingListStore.getState().resetState()
        await ensurePhishingListsSeeded({ loadSnapshot: async () => SNAPSHOT })
        await getProvider().connections.store.clear()
        resetConnectionPairingStateForTesting()
        vi.clearAllMocks()
        // The review sheet looks the peer up in the projects API.
        server.use(http.get('*/v1/projects/', () => HttpResponse.json([])))
    })

    afterEach(async () => {
        vi.restoreAllMocks()
        onlineManager.setOnline(true)
        useSigningStore.getState().resetState()
        useContactsStore.setState({ contacts: [] })
        await getProvider().connections.store.clear()
        useAccountsStore.getState().setAccounts([])
        useRemoteConfigStore.getState().resetState()
    })

    describe('on Ethereum', () => {
        beforeEach(async () => {
            useAccountsStore.getState().setAccounts([ETHEREUM_ACCOUNT])
            useContactsStore.setState({
                contacts: [
                    { id: 'carol', name: 'Carol', addresses: { evm: CONTACT } },
                ],
            })
            setCapabilityOverrides(
                { dappConnect: true, contractDecoding: true },
                'ethereum',
            )
            vi.spyOn(kmsCore, 'sign').mockImplementation(async (_id, payload) =>
                vectorSignature(payload),
            )
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
            server.use(...evmRpcHandlers())
        })

        const connectEthereum = () =>
            connectSession(
                {
                    requiredNamespaces: {
                        eip155: {
                            chains: [ETH_MAINNET],
                            methods: [
                                'eth_sendTransaction',
                                'eth_signTypedData_v4',
                            ],
                            events: [],
                        },
                    },
                },
                ETHEREUM_ACCOUNT.id,
            )

        const approveDrainer = (walletKit: FakeWalletKit) =>
            send(walletKit, 'eth_sendTransaction', [
                {
                    from: SENDER,
                    to: USDC,
                    value: '0x0',
                    data: APPROVE_DRAINER_DATA,
                },
            ])

        it('Given a listed drainer, when a dApp asks to approve it as a spender, then the review flags it with the suspicious badge and signing waits on acknowledgement', async () => {
            const walletKit = await connectEthereum()

            approveDrainer(walletKit)
            await findSlide(TRANSACTION_SLIDE)

            await waitFor(() => expect(screen.getByTestId(LISTED)).toBeTruthy())
            expect(screen.getByTestId(LISTED).textContent).toBe(DRAINER)
            expect(screen.getByTestId(LISTED_BADGE)).toBeTruthy()
            expect(
                screen.getByText('signing.address_safety.listed_title'),
            ).toBeTruthy()
            expect(
                screen.getByText('signing.address_safety.role.spender'),
            ).toBeTruthy()
            await expectHeldUntilAcknowledged(TRANSACTION_SLIDE)
            await expectNotSentForLookup([DRAINER])
        })

        it('Given the device is offline, when a dApp asks to approve a listed drainer, then the review still flags it', async () => {
            const walletKit = await connectEthereum()
            onlineManager.setOnline(false)

            approveDrainer(walletKit)
            await findSlide(TRANSACTION_SLIDE)

            await waitFor(() => expect(screen.getByTestId(LISTED)).toBeTruthy())
            await expectHeldUntilAcknowledged(TRANSACTION_SLIDE)
        })

        // The last two are permits the spend-approval parser can't read, so
        // only the schema walk names their spender.
        it.each([
            ['a Permit2 signature', PERMIT2_SINGLE_UNLIMITED_TYPED_DATA],
            ['a DAI permit', DAI_PERMIT_TYPED_DATA],
            [
                'a Permit2 message with no deadline',
                PERMIT2_SINGLE_NO_DEADLINE_TYPED_DATA,
            ],
        ])(
            'Given a listed drainer, when a dApp asks for %s naming it as the spender, then the review flags it the same way',
            async (_label, typedData) => {
                const walletKit = await connectEthereum()

                send(walletKit, 'eth_signTypedData_v4', [
                    SENDER,
                    JSON.stringify(typedData),
                ])
                await findSlide(MESSAGE_SLIDE)

                await waitFor(() =>
                    expect(screen.getByTestId(LISTED)).toBeTruthy(),
                )
                expect(
                    screen.getByTestId(LISTED).textContent?.toLowerCase(),
                ).toBe(DRAINER.toLowerCase())
                expect(screen.getByTestId(LISTED_BADGE)).toBeTruthy()
                await expectHeldUntilAcknowledged(MESSAGE_SLIDE)
                await expectNotSentForLookup([DRAINER])
            },
        )

        it('Given a listed drainer and a contact, when a dApp asks to approve the drainer on a contract imitating the contact, then the review explains both warnings', async () => {
            const walletKit = await connectEthereum()

            send(walletKit, 'eth_sendTransaction', [
                {
                    from: SENDER,
                    to: CONTACT_LOOK_ALIKE,
                    value: '0x0',
                    data: APPROVE_DRAINER_DATA,
                },
            ])
            await findSlide(TRANSACTION_SLIDE)

            await waitFor(() => expect(screen.getByTestId(LISTED)).toBeTruthy())
            expect(
                screen
                    .getByTestId('request_address_look_alike_1')
                    .textContent?.toLowerCase(),
            ).toBe(CONTACT_LOOK_ALIKE)
            expect(
                screen.getByTestId('request_address_listed_body'),
            ).toBeTruthy()
            expect(
                screen.getByTestId('request_address_look_alike_body'),
            ).toBeTruthy()
            await expectHeldUntilAcknowledged(TRANSACTION_SLIDE)
        })

        it('Given a contact, when a dApp sends native ETH to an address imitating it, then the review compares both in full and signing waits on acknowledgement', async () => {
            const walletKit = await connectEthereum()

            send(walletKit, 'eth_sendTransaction', [
                { from: SENDER, to: CONTACT_LOOK_ALIKE, value: '0x1' },
            ])
            await findSlide(TRANSACTION_SLIDE)

            await waitFor(() =>
                expect(screen.getByTestId(LOOK_ALIKE)).toBeTruthy(),
            )
            expect(
                screen.getByTestId(LOOK_ALIKE).textContent?.toLowerCase(),
            ).toBe(CONTACT_LOOK_ALIKE)
            expect(
                screen.getByTestId(LOOK_ALIKE_KNOWN).textContent?.toLowerCase(),
            ).toBe(CONTACT.toLowerCase())
            await expectHeldUntilAcknowledged(TRANSACTION_SLIDE)
            await expectNotSentForLookup([CONTACT_LOOK_ALIKE])
        })

        it('Given a contract the user never used, on no list and like nothing known, when a dApp calls it, then neither warning shows and signing is not held', async () => {
            const walletKit = await connectEthereum()

            send(walletKit, 'eth_sendTransaction', [
                {
                    from: SENDER,
                    to: UNLISTED_CONTRACT,
                    value: '0x0',
                    data: '0xdeadbeef',
                },
            ])
            await findSlide(TRANSACTION_SLIDE)

            await waitFor(() =>
                expect(
                    isElementDisabled(screen.getByTestId(TRANSACTION_SLIDE)),
                ).toBe(false),
            )
            expect(screen.queryByTestId(WARNING)).toBeNull()
        })
    })

    describe('on Algorand', () => {
        let signSpy: MockInstance

        beforeEach(async () => {
            await seedAlgoAsset('mainnet')
            useNetworkStore.getState().setMode('live')
            signSpy = vi
                .spyOn(getProvider().key.store, 'sign')
                .mockResolvedValue(new Uint8Array(64).fill(7))
            server.use(
                mockAlgodTransactionParams({
                    response: { fee: 1000, 'min-fee': 1000 },
                }),
                mockAlgodAccountInformation({
                    address: ALGO25_TEST_ADDRESS,
                    response: { amount: 5_000_000, 'min-balance': 100_000 },
                }),
                mockAlgodStatus({ response: { 'last-round': 100 } }),
                mockIndexerSearchForAccounts(),
            )
        })

        afterEach(() => {
            signSpy.mockRestore()
        })

        it("Given one of the user's accounts, when a dApp pays an address imitating it, then the review shows both addresses in full and signing waits on acknowledgement", async () => {
            const signer = await seedAlgo25Signer()
            useAccountsStore.getState().setAccounts([signer, SAVINGS_ACCOUNT])
            const walletKit = await connectSession(
                {
                    requiredNamespaces: {
                        algorand: {
                            chains: [MAINNET_CHAIN_ID],
                            methods: ['algo_signTxn'],
                            events: [],
                        },
                    },
                },
                signer.id,
            )

            const requested = buildPaymentTransaction({
                sender: addressOf(signer),
                receiver: SAVINGS_LOOK_ALIKE,
                amount: 1_000_000n,
            })
            send(
                walletKit,
                'algo_signTxn',
                [[{ txn: encodeToBase64(encodeTransactionRaw(requested)) }]],
                MAINNET_CHAIN_ID,
            )
            await findSlide(TRANSACTION_SLIDE)

            await waitFor(() =>
                expect(screen.getByTestId(LOOK_ALIKE)).toBeTruthy(),
            )
            expect(screen.getByTestId(LOOK_ALIKE).textContent).toBe(
                SAVINGS_LOOK_ALIKE,
            )
            expect(screen.getByTestId(LOOK_ALIKE_KNOWN).textContent).toBe(
                SAVINGS,
            )
            await expectHeldUntilAcknowledged(TRANSACTION_SLIDE)
            await expectNotSentForLookup([SAVINGS_LOOK_ALIKE])
        })
    })
})
