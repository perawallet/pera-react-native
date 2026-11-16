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
// device's scam-address list, or one imitating an address the user knows. A
// listed address leaves Reject as the only action; a look-alike is released by
// an acknowledgement. The lists are seeded from a fixture snapshot into the
// real database, and the review is the real sign sheet with only
// `@reown/walletkit` stubbed.

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
    type RequestOverrides,
    TOPIC as V2_SESSION_TOPIC,
    V2_URI,
} from '@packages/walletconnect/src/v2/__tests__/fakeWalletKit'
import { useSigningStore } from '@packages/signing/src/store'
import { __resetSigningActorRegistryForTests } from '@packages/signing/src/hooks/useSigningActorLifecycle'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { selectEvmConnectAccount } from '@test-utils/connect-account'
import { server, setSuiteUnhandledRequestMode } from '@test-utils/msw-server'
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
import {
    closestPressable,
    getAllPressables,
    isElementDisabled,
} from '@test-utils/rnw'
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
                ? { mainnet: ['https://mainnet.rpc.test/'] }
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
const padded = (address: string) =>
    address.slice(2).toLowerCase().padStart(64, '0')
// approve(DRAINER, 2^256-1)
const APPROVE_DRAINER_DATA = `0x095ea7b3${padded(DRAINER)}${'f'.repeat(64)}`
// approve(UNLISTED_CONTRACT, 2^256-1)
const APPROVE_UNLISTED_DATA = `0x095ea7b3${padded(UNLISTED_CONTRACT)}${'f'.repeat(64)}`
// setApprovalForAll(DRAINER, true)
const SET_APPROVAL_FOR_ALL_DRAINER_DATA = `0xa22cb465${padded(DRAINER)}${'0'.repeat(63)}1`

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
const TRANSACTION_BLOCKED = 'signing-cannot-sign'
const MESSAGE_BLOCKED = 'message-signing-blocked'
const TRANSACTION_REJECT = 'signing_reject_button'
const MESSAGE_REJECT = 'message-signing-reject-button'
const SITE_WARNING = 'request_site_warning'
const SITE_ACKNOWLEDGE = 'request_site_acknowledge'

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
    const account = useAccountsStore
        .getState()
        .accounts.find(({ id }) => id === accountId)
    if (!account) throw new Error(`No account ${accountId}`)
    if (account.chains.algorand) {
        const row = `wc_account_row_${accountId}`
        await waitFor(() => expect(screen.getByTestId(row)).toBeTruthy(), {
            timeout: 5000,
        })
        fireEvent.click(screen.getByTestId(row))
    } else {
        await selectEvmConnectAccount(account)
    }
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
    verified?: RequestOverrides['verified'],
) =>
    act(() => {
        walletKit.emit(
            'session_request',
            makeRequest({ id: 7, method, params, chainId, verified }),
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

// A listed address offers no way to confirm: no slider, no acknowledgement,
// only the notice and Reject.
const expectBlocked = async (
    noticeTestId: string,
    slideTestId: string,
    rejectTestId: string,
    walletKit: FakeWalletKit,
) => {
    const notice = await findSlide(noticeTestId)
    expect(notice.textContent).toContain('signing.address_safety.blocked_title')
    expect(screen.queryByTestId(slideTestId)).toBeNull()
    expect(screen.queryByTestId(ACKNOWLEDGE)).toBeNull()

    fireEvent.click(screen.getByTestId(rejectTestId))
    await waitFor(() =>
        expect(walletKit.respondSessionRequest).toHaveBeenCalled(),
    )
    const [{ response }] = walletKit.respondSessionRequest.mock.calls[0]
    expect('error' in response).toBe(true)
    expect(kmsCore.sign).not.toHaveBeenCalled()
}

// The sign gate blocks a flagged site first; the review then names it again.
const continuePastBlockedView = async () => {
    await waitFor(() => screen.getByTestId('site_blocked_view'), {
        timeout: 15_000,
    })
    fireEvent.click(screen.getByTestId('site_blocked_continue_anyway'))
    fireEvent.click(screen.getByTestId('site_blocked_acknowledge'))
    const continueButton = () =>
        closestPressable(screen.getByTestId('site_blocked_continue'))!
    await waitFor(() => expect(isElementDisabled(continueButton())).toBe(false))
    fireEvent.click(continueButton())
}

const expectSiteHeldUntilAcknowledged = async (slideTestId: string) => {
    await waitFor(() => screen.getByTestId(SITE_WARNING), { timeout: 15_000 })
    expect(screen.getByTestId('request_site_host').textContent).toBe(
        'dapp.example',
    )
    expect(screen.queryByTestId(WARNING)).toBeNull()
    await waitFor(() =>
        expect(isElementDisabled(screen.getByTestId(slideTestId))).toBe(true),
    )

    fireEvent.click(screen.getByTestId(SITE_ACKNOWLEDGE))
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
// Pera for an address's name to display it, as for any request.
// What must never happen is a request address going anywhere else.
const isDisplayOrChainRequest = (url: URL) =>
    url.host === RPC_HOST || url.pathname.endsWith('/api/v4/accounts/names/')

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
                                'wallet_sendCalls',
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

        it('Given a listed drainer, when a dApp asks to approve it as a spender, then the review flags it, shows the unlimited permission and offers only Reject', async () => {
            const walletKit = await connectEthereum()

            approveDrainer(walletKit)
            await findSlide(TRANSACTION_BLOCKED)

            await waitFor(() => expect(screen.getByTestId(LISTED)).toBeTruthy())
            expect(screen.getByTestId(LISTED).textContent).toBe(DRAINER)
            expect(screen.getByTestId(LISTED_BADGE)).toBeTruthy()
            expect(
                screen.getByText('signing.address_safety.listed_title'),
            ).toBeTruthy()
            expect(
                screen.getByText('signing.address_safety.role.spender'),
            ).toBeTruthy()
            // The permission card takes the changes slot once the simulation settles.
            await waitFor(() =>
                expect(
                    screen.getByTestId('ethereum_review_permission'),
                ).toBeTruthy(),
            )
            expect(
                screen.getByTestId('ethereum_review_permission_unlimited'),
            ).toBeTruthy()
            await expectBlocked(
                TRANSACTION_BLOCKED,
                TRANSACTION_SLIDE,
                TRANSACTION_REJECT,
                walletKit,
            )
            await expectNotSentForLookup([DRAINER])
        })

        it('Given remote config turns the hard block off, when a dApp asks to approve a listed drainer, then the review still flags it and the slide unlocks once the user acknowledges', async () => {
            useRemoteConfigStore
                .getState()
                .setConfigOverride('enable_listed_address_hard_block', false)
            const walletKit = await connectEthereum()

            approveDrainer(walletKit)
            await findSlide(TRANSACTION_SLIDE)

            await waitFor(() => expect(screen.getByTestId(LISTED)).toBeTruthy())
            expect(
                screen.getByText('signing.address_safety.listed_title'),
            ).toBeTruthy()
            expect(screen.queryByTestId(TRANSACTION_BLOCKED)).toBeNull()
            await expectHeldUntilAcknowledged(TRANSACTION_SLIDE)
        })

        it('Given the device is offline, when a dApp asks to approve a listed drainer, then the review still blocks it', async () => {
            const walletKit = await connectEthereum()
            onlineManager.setOnline(false)

            approveDrainer(walletKit)
            await findSlide(TRANSACTION_BLOCKED)

            await waitFor(() => expect(screen.getByTestId(LISTED)).toBeTruthy())
            await expectBlocked(
                TRANSACTION_BLOCKED,
                TRANSACTION_SLIDE,
                TRANSACTION_REJECT,
                walletKit,
            )
        })

        it('Given a listed drainer, when a dApp calls it directly, then the review names it as the contract and blocks it', async () => {
            const walletKit = await connectEthereum()

            send(walletKit, 'eth_sendTransaction', [
                { from: SENDER, to: DRAINER, value: '0x0', data: '0xdeadbeef' },
            ])
            await findSlide(TRANSACTION_BLOCKED)

            await waitFor(() => expect(screen.getByTestId(LISTED)).toBeTruthy())
            expect(
                screen.getByText('signing.address_safety.role.target'),
            ).toBeTruthy()
            await expectBlocked(
                TRANSACTION_BLOCKED,
                TRANSACTION_SLIDE,
                TRANSACTION_REJECT,
                walletKit,
            )
        })

        it('Given a listed drainer, when a dApp asks for setApprovalForAll to it, then the review names it as the operator and blocks it', async () => {
            const walletKit = await connectEthereum()

            send(walletKit, 'eth_sendTransaction', [
                {
                    from: SENDER,
                    to: UNLISTED_CONTRACT,
                    value: '0x0',
                    data: SET_APPROVAL_FOR_ALL_DRAINER_DATA,
                },
            ])
            await findSlide(TRANSACTION_BLOCKED)

            await waitFor(() => expect(screen.getByTestId(LISTED)).toBeTruthy())
            expect(
                screen.getByText('signing.address_safety.role.operator'),
            ).toBeTruthy()
            await expectBlocked(
                TRANSACTION_BLOCKED,
                TRANSACTION_SLIDE,
                TRANSACTION_REJECT,
                walletKit,
            )
        })

        it('Given a batch whose second call approves a listed drainer, when a dApp sends it, then the review blocks the whole batch', async () => {
            const walletKit = await connectEthereum()

            send(walletKit, 'wallet_sendCalls', [
                {
                    version: '2.0.0',
                    id: 'unlisted-then-drainer',
                    chainId: '0x1',
                    from: SENDER,
                    atomicRequired: false,
                    calls: [
                        {
                            to: UNLISTED_CONTRACT,
                            value: '0x0',
                            data: '0xdeadbeef',
                        },
                        { to: USDC, value: '0x0', data: APPROVE_DRAINER_DATA },
                    ],
                },
            ])
            await findSlide(TRANSACTION_BLOCKED)

            await waitFor(() => expect(screen.getByTestId(LISTED)).toBeTruthy())
            expect(screen.getByTestId(LISTED).textContent).toBe(DRAINER)
            await expectBlocked(
                TRANSACTION_BLOCKED,
                TRANSACTION_SLIDE,
                TRANSACTION_REJECT,
                walletKit,
            )
        })

        // The last is a permit the spend-approval parser can't read, so only
        // the schema walk names its spender.
        it.each([
            ['a Permit2 signature', PERMIT2_SINGLE_UNLIMITED_TYPED_DATA],
            ['a DAI permit', DAI_PERMIT_TYPED_DATA],
            [
                'a Permit2 message with no deadline',
                PERMIT2_SINGLE_NO_DEADLINE_TYPED_DATA,
            ],
        ])(
            'Given a listed drainer, when a dApp asks for %s naming it as the spender, then the review blocks it the same way',
            async (_label, typedData) => {
                const walletKit = await connectEthereum()

                send(walletKit, 'eth_signTypedData_v4', [
                    SENDER,
                    JSON.stringify(typedData),
                ])
                await findSlide(MESSAGE_BLOCKED)

                await waitFor(() =>
                    expect(screen.getByTestId(LISTED)).toBeTruthy(),
                )
                expect(
                    screen.getByTestId(LISTED).textContent?.toLowerCase(),
                ).toBe(DRAINER.toLowerCase())
                expect(screen.getByTestId(LISTED_BADGE)).toBeTruthy()
                await expectBlocked(
                    MESSAGE_BLOCKED,
                    MESSAGE_SLIDE,
                    MESSAGE_REJECT,
                    walletKit,
                )
                await expectNotSentForLookup([DRAINER])
            },
        )

        it('Given a listed drainer and a contact, when a dApp asks to approve the drainer on a contract imitating the contact, then the review explains both warnings and blocks it', async () => {
            const walletKit = await connectEthereum()

            send(walletKit, 'eth_sendTransaction', [
                {
                    from: SENDER,
                    to: CONTACT_LOOK_ALIKE,
                    value: '0x0',
                    data: APPROVE_DRAINER_DATA,
                },
            ])
            await findSlide(TRANSACTION_BLOCKED)

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
            await expectBlocked(
                TRANSACTION_BLOCKED,
                TRANSACTION_SLIDE,
                TRANSACTION_REJECT,
                walletKit,
            )
        })

        it('Given WalletConnect Verify flags the dApp, when it asks for an approval to an unlisted spender and the user continues past the blocked view, then the review names the site again and holds the slide until acknowledged', async () => {
            const walletKit = await connectEthereum()

            send(
                walletKit,
                'eth_sendTransaction',
                [
                    {
                        from: SENDER,
                        to: USDC,
                        value: '0x0',
                        data: APPROVE_UNLISTED_DATA,
                    },
                ],
                ETH_MAINNET,
                { isScam: true },
            )
            await continuePastBlockedView()

            await expectSiteHeldUntilAcknowledged(TRANSACTION_SLIDE)
        })

        it('Given WalletConnect Verify flags the dApp, when it asks to sign a permit to an unlisted spender and the user continues past the blocked view, then the review names the site again and holds the slide until acknowledged', async () => {
            const walletKit = await connectEthereum()

            send(
                walletKit,
                'eth_signTypedData_v4',
                [
                    SENDER,
                    JSON.stringify({
                        ...DAI_PERMIT_TYPED_DATA,
                        message: {
                            ...DAI_PERMIT_TYPED_DATA.message,
                            spender: UNLISTED_CONTRACT,
                        },
                    }),
                ],
                ETH_MAINNET,
                { isScam: true },
            )
            await continuePastBlockedView()

            await expectSiteHeldUntilAcknowledged(MESSAGE_SLIDE)
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
