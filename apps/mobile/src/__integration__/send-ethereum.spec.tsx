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

// A send from an Ethereum account resolves everything from that account's
// chain: the codec refuses another chain's receiver, the transfer adapter
// builds an EIP-1559 transaction, and its broadcaster submits it.

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
import { Decimal } from 'decimal.js'
import {
    act,
    fireEvent,
    renderHook,
    screen,
    waitFor,
    within,
} from '@testing-library/react'
import { Notifier } from 'react-native-notifier'

import {
    insertAssetHolding,
    upsertAccountChainState,
    useAccountChainStateStore,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { nativeAssetFor, upsertAssets } from '@perawallet/wallet-core-assets'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import { useContacts } from '@perawallet/wallet-core-contacts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    DEFAULT_EVM_RPC_RESPONSES,
    evmRpcHandlers,
} from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { kmsCore, SeedScheme } from '@perawallet/wallet-core-kms'
import { getPendingTransactionRecords } from '@perawallet/wallet-core-transactions'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { findEnabledByTestId, isElementDisabled } from '@test-utils/rnw'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { useSettingsStore } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { useSendFundsStore } from '@modules/transactions'
import { InputScreen } from '@modules/transactions/screens/send-funds/InputScreen/InputScreen'
import { TransactionConfirmationScreen } from '@modules/transactions/screens/send-funds/TransactionConfirmationScreen/TransactionConfirmationScreen'
import { TransactionProcessingScreen } from '@modules/transactions/screens/send-funds/TransactionProcessingScreen/TransactionProcessingScreen'
import { SelectDestinationScreen } from '@modules/transactions/screens/send-funds/SelectDestinationScreen/SelectDestinationScreen'
import { TransactionSuccessScreen } from '@modules/transactions/routes'
import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'
import {
    recordAnalyticsEvents,
    type AnalyticsRecorder,
} from '@test-utils/analytics-recorder'
import { expectFlowEvents } from './__fixtures__/analytics-flows'

const RPC_URL = 'https://mainnet.rpc.test/'

// The integration setup registers whichever chains config enables, and hands
// each chain the endpoints config gives it; tests leave Ethereum's RPC unset.
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

const ETH_SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

// Hardhat accounts #0 and #1, from the public test mnemonic.
const SENDER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const RECEIVER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const UNKNOWN_RECIPIENT = '0x000000000000000000000000000000000000dEaD'
const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

// An HD account, so its signing scheme resolves without the keystore loading
// the key.
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

const ALGORAND_SENDER: WalletAccount = {
    id: 'algo-sender',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'algo-key' },
    },
    name: 'Algo sender',
}

const selectSender = (account: WalletAccount) => {
    useAccountsStore.getState().setAccounts([account])
    useAccountsStore.getState().setSelectedAccountId(account.id)
}

// Ethereum keys never exist in JS, and the in-memory keystore holds none, so
// the KMS answers with signatures Hardhat #0 made over these exact digests, in
// its r‖s‖recovery encoding. The RPC fixture defaults (nonce 0, 21000 gas,
// 1 gwei base fee and tip) make each build deterministic; a digest missing
// here means the build changed and the signature must be regenerated.
const SENDER_SIGNATURES: Record<string, string> = {
    // 0.5 ETH to RECEIVER.
    '4c7de634dc88b13890e379a0156d0c4f1e4dd515384bf403285c40e2e3191177':
        '923c0f4c3ec362322e052c7d1f1d6ea2a364621802f4428c6508a4fe71a655ef332789ab7ace0f5c627bcda10589e4e437c568bfb39cd09f4dc40da8789c05ac01',
    // MAX ether to RECEIVER at the 1 / 2 / 3 gwei tips below: 10 ETH less 21000 x 3 gwei (slow) ...
    c8ade2d7f62900de2edd5f323ecdf69ee1e9522ce2aac52d2157102b34111284:
        '2a6df7e334bf12e2ebd184a4048c539219537cccade71b9b60bd0659754162d919cf0b6f1ea67f83954c4ff05f60f22d9132bd4a358eeee2af4b267800a55edd01',
    // ... and 10 ETH less 21000 x 4 gwei (normal).
    '90fac667aad1a634739d01e2823d7da0caa379757a3afa6331859377cb65ef42':
        '791adf986b26f0aeabb69961bec577d4fed0ad0534722123c4881c9ee84cb8f21a86a6dbacc3ceacfbb595cc9f71662cb3af58fd38c082a42b613cee122e3ca100',
    // 12.5 USDC to RECEIVER.
    c5569438e751d113261af83d1392f433cd97e6fec935fb66fba51a9acbf9986b:
        'd777a894919655824d4240e1fb1c2d37302c2f9c1126bc071233c420319e8f815bb84e8b33cd492f52e793fda8414e491df508d3d72023e14d6cab50777aa75800',
}

const signWithSenderKey = async (_keyPairId: string, digest: Uint8Array) => {
    const hex = Buffer.from(digest).toString('hex')
    const signature = SENDER_SIGNATURES[hex]
    if (!signature) throw new Error(`No fixture signature for digest ${hex}`)
    return Uint8Array.from(Buffer.from(signature, 'hex'))
}

const sentRecord = async () => {
    const [record] = await getPendingTransactionRecords({
        address: SENDER,
        scope: ETH_SCOPE,
        listedIds: new Set(),
    })
    return record
}

const seedEthereumAssets = async () => {
    const ether = nativeAssetFor('ethereum')
    await upsertAssets({
        items: [
            ether,
            {
                ...ether,
                assetId: TOKEN,
                name: 'USD Coin',
                unitName: 'USDC',
                decimals: 6,
            },
        ],
        scope: ETH_SCOPE,
    })
}

// The confirm step checks the synced native balance covers the worst-case fee.
const seedSenderEther = (wei: string) =>
    upsertAccountChainState({
        accountAddress: SENDER,
        scope: ETH_SCOPE,
        nativeBalance: new Decimal(wei),
        chainData: { family: 'evm', nonce: { latest: 0, pending: 0 } },
    })

const renderSendConfirmationStack = () =>
    renderWithNavigation(TransactionConfirmationScreen, 'ConfirmTransaction', {
        additionalScreens: [
            {
                name: 'TransactionProcessing',
                component: TransactionProcessingScreen,
            },
            {
                name: 'TransactionSuccess',
                component: TransactionSuccessScreen,
            },
        ],
    })

const confirmSend = async () => {
    fireEvent.click(
        await findEnabledByTestId('send_confirm_button', { timeout: 5000 }),
    )
    await waitFor(
        () => expect(screen.getByTestId('send_success')).toBeTruthy(),
        {
            timeout: 10_000,
        },
    )
}

describe('Flow: send from an Ethereum account', () => {
    let analytics: AnalyticsRecorder
    beforeEach(() => {
        analytics = recordAnalyticsEvents()
    })
    afterEach(() => {
        analytics.restore()
    })

    const sentRawTransactions: string[] = []

    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedEthereumAssets()
        await seedSenderEther('10000000000000000000')
        useAccountsStore.getState().setAccounts([])
        useAccountChainStateStore.getState().resetState()
        useSendFundsStore.getState().reset()
        useSettingsStore.getState().resetState()
        useSettingsStore
            .getState()
            .setPreference(UserPreferences.transactionInfoAgreed, true)
        vi.mocked(Notifier.showNotification).mockClear()
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
    })

    it('Given an ether send, when the user confirms, then an EIP-1559 transfer to the receiver reaches the node', async () => {
        selectSender(ETHEREUM_SENDER)
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'ethereum', assetId: 'native' })
        useSendFundsStore.getState().setAmount(new Decimal('0.5'))
        useSendFundsStore.getState().setDestination(RECEIVER)
        useSendFundsStore.getState().setSendMode('normal')

        renderSendConfirmationStack()
        await confirmSend()

        // Broadcast is not mined: the screen says submitted and names Etherscan.
        expect(
            screen.getByText('send_funds.success.pending_title'),
        ).toBeTruthy()
        expect(
            screen.getByText('send_funds.success.view_on_explorer'),
        ).toBeTruthy()
        expect(sentRawTransactions).toHaveLength(1)
        // Read back by the address its signature recovers to.
        expect((await sentRecord())?.summary).toMatchObject({
            kind: 'transfer',
            counterparty: RECEIVER,
            amount: {
                assetRef: { chainId: 'ethereum', assetId: 'native' },
                value: new Decimal('500000000000000000'),
            },
        })
        expectFlowEvents(analytics, 'send', 'ethereum')
    })

    it('Given an ether send, when the amount screen opens, then it offers MAX but no note', async () => {
        await insertAssetHolding({
            accountAddress: SENDER,
            assetId: nativeAssetFor('ethereum').assetId,
            scope: ETH_SCOPE,
            amount: new Decimal('10000000000000000000'),
        })
        selectSender(ETHEREUM_SENDER)
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'ethereum', assetId: 'native' })

        renderWithNavigation(InputScreen, 'InputAmount')

        expect(
            await screen.findByTestId('send_input_max_button', undefined, {
                timeout: 5000,
            }),
        ).toBeTruthy()
        expect(screen.queryByTestId('send_input_note_button')).toBeNull()
    })

    it("Given an account on Algorand and Ethereum, when it sends ether, then the send runs on the asset's chain", async () => {
        selectSender({
            ...ETHEREUM_SENDER,
            chains: {
                algorand: {
                    address: ALGO25_TEST_ADDRESS,
                    keyPairId: 'algo-key',
                },
                ...ETHEREUM_SENDER.chains,
            },
        })
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'ethereum', assetId: 'native' })
        useSendFundsStore.getState().setAmount(new Decimal('0.5'))
        useSendFundsStore.getState().setDestination(RECEIVER)
        useSendFundsStore.getState().setSendMode('normal')

        renderSendConfirmationStack()
        await confirmSend()

        expect(sentRawTransactions).toHaveLength(1)
        expect((await sentRecord())?.summary).toMatchObject({
            kind: 'transfer',
            counterparty: RECEIVER,
            amount: { assetRef: { chainId: 'ethereum', assetId: 'native' } },
        })
    })

    it("Given an ether send the balance can't cover with its worst-case fee, when the user reviews it, then the review says so and Confirm stays off", async () => {
        await seedSenderEther('500000000000000000')
        selectSender(ETHEREUM_SENDER)
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'ethereum', assetId: 'native' })
        useSendFundsStore.getState().setAmount(new Decimal('0.5'))
        useSendFundsStore.getState().setDestination(RECEIVER)
        useSendFundsStore.getState().setSendMode('normal')

        renderSendConfirmationStack()

        expect(
            await screen.findByTestId('send_fee_shortfall', undefined, {
                timeout: 5000,
            }),
        ).toBeTruthy()
        const confirm = screen.getByTestId('send_confirm_button')
        expect(isElementDisabled(confirm)).toBe(true)
        fireEvent.click(confirm)
        expect(screen.queryByTestId('send_success')).toBeNull()
        expect(sentRawTransactions).toHaveLength(0)
    })

    describe('a MAX ether send', () => {
        // 1 gwei base fee; tips of 1, 2 and 3 gwei for slow, normal and fast.
        const GWEI = '0x3b9aca00'
        const TIPS: `0x${string}`[] = ['0x3b9aca00', '0x77359400', '0xb2d05e00']
        const TEN_ETHER = new Decimal('10000000000000000000')

        beforeEach(() => {
            server.use(
                ...evmRpcHandlers({
                    rpcUrl: RPC_URL,
                    responses: {
                        eth_feeHistory: {
                            oldestBlock: '0x1',
                            baseFeePerGas: [GWEI, GWEI],
                            gasUsedRatio: [0.5],
                            reward: [TIPS],
                        },
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

        it.each([
            ['slow', '9999937000000000000'],
            ['normal', '9999916000000000000'],
        ] as const)(
            "Given MAX ether and the %s speed, when the user confirms, then the node gets the balance less that speed's max fee and nothing else is held back",
            async (preset, expectedWei) => {
                selectSender(ETHEREUM_SENDER)
                useSendFundsStore.getState().setSelectedAsset({
                    chainId: 'ethereum',
                    assetId: 'native',
                })
                // What the amount step stored at some other speed; the review re-sizes it.
                useSendFundsStore.getState().setAmount(new Decimal('9.5'))
                useSendFundsStore.getState().setIsMaxAmount(true)
                useSendFundsStore.getState().setFeePreset(preset)
                useSendFundsStore.getState().setDestination(RECEIVER)
                useSendFundsStore.getState().setSendMode('normal')

                renderSendConfirmationStack()
                await confirmSend()

                const record = await sentRecord()
                expect(record?.summary).toMatchObject({
                    amount: { value: new Decimal(expectedWei) },
                })
                // The fee is the most the send can be charged: amount plus fee is the whole balance.
                expect(record?.fee?.toFixed()).toBe(
                    TEN_ETHER.minus(expectedWei).toFixed(),
                )
            },
        )
    })

    it('Given an ether send, when the user reviews it, then each speed shows its wait and the review totals the send with its fee', async () => {
        selectSender(ETHEREUM_SENDER)
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'ethereum', assetId: 'native' })
        useSendFundsStore.getState().setAmount(new Decimal('0.5'))
        useSendFundsStore.getState().setDestination(RECEIVER)
        useSendFundsStore.getState().setSendMode('normal')

        renderSendConfirmationStack()

        for (const preset of ['slow', 'normal', 'fast']) {
            expect(
                await screen.findByTestId(`fee_preset_${preset}_wait`),
            ).toBeTruthy()
        }
        expect(screen.getByTestId('fee_max_info')).toBeTruthy()
        const total = await screen.findByTestId('send_confirm_total')
        await waitFor(() => expect(total.textContent).toMatch(/0\.5\d*[1-9]/))
        expect(screen.queryByTestId('send_fee_shortfall')).toBeNull()

        fireEvent.click(screen.getByTestId('fee_preset_slow'))

        await waitFor(() =>
            expect(useSendFundsStore.getState().feePreset).toBe('slow'),
        )
    })

    it('Given an ERC-20 send, when the user confirms, then a token transfer call reaches the node', async () => {
        selectSender(ETHEREUM_SENDER)
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'ethereum', assetId: TOKEN })
        useSendFundsStore.getState().setAmount(new Decimal('12.5'))
        useSendFundsStore.getState().setDestination(RECEIVER)
        useSendFundsStore.getState().setSendMode('normal')

        renderSendConfirmationStack()
        await confirmSend()

        expect(sentRawTransactions).toHaveLength(1)
        expect((await sentRecord())?.summary).toMatchObject({
            kind: 'token-transfer',
            counterparty: RECEIVER,
            amount: {
                assetRef: { chainId: 'ethereum', assetId: TOKEN },
                value: new Decimal(12_500_000),
            },
        })
    })

    it('Given an Ethereum account, when an Algorand address is the receiver, then the send refuses it', async () => {
        selectSender(ETHEREUM_SENDER)
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'ethereum', assetId: 'native' })
        useSendFundsStore.getState().setAmount(new Decimal('0.5'))
        useSendFundsStore.getState().setDestination(ALGO25_TEST_ADDRESS)

        renderWithNavigation(SelectDestinationScreen, 'SelectDestination')

        await waitFor(() =>
            expect(Notifier.showNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'send_funds.destination.invalid_address_title',
                }),
            ),
        )
        expect(useSendFundsStore.getState().destination).toBeUndefined()
        expect(sentRawTransactions).toHaveLength(0)
    })

    it('Given an Algorand account, when a 0x address is the receiver, then the send refuses it', async () => {
        await seedAlgoAsset('mainnet')
        selectSender(ALGORAND_SENDER)
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'algorand', assetId: '0' })
        useSendFundsStore.getState().setAmount(new Decimal(1))
        useSendFundsStore.getState().setDestination(RECEIVER)

        renderWithNavigation(SelectDestinationScreen, 'SelectDestination')

        await waitFor(() =>
            expect(Notifier.showNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'send_funds.destination.invalid_address_title',
                }),
            ),
        )
        expect(useSendFundsStore.getState().destination).toBeUndefined()
    })

    describe('the recipient picker and review on an Ethereum send', () => {
        const ETH_TEST_ACCOUNT: WalletAccount = {
            id: 'eth-test',
            custody: { kind: 'local', seed: null },
            chains: {
                algorand: { address: HD_TEST_ADDRESS, keyPairId: 'k-1' },
                ethereum: { address: RECEIVER, keyPairId: 'k-2' },
            },
            name: 'ETH Test',
        }
        const WATCH_ONLY_ACCOUNT: WalletAccount = {
            id: 'watch-only',
            custody: { kind: 'watch' },
            chains: { algorand: { address: 'WATCHONLYADDR' } },
            name: 'Watch only',
        }
        const SENDER_ON_BOTH: WalletAccount = {
            ...ETHEREUM_SENDER,
            chains: {
                algorand: {
                    address: ALGO25_TEST_ADDRESS,
                    keyPairId: 'algo-key',
                },
                ...ETHEREUM_SENDER.chains,
            },
        }

        const seedContacts = () => {
            const { result } = renderHook(() => useContacts())
            act(() => {
                for (const contact of result.current.contacts) {
                    result.current.deleteContact(contact.id)
                }
                result.current.addContact({
                    name: 'Eth friend',
                    addresses: { evm: TOKEN },
                })
                result.current.addContact({
                    name: 'Algo friend',
                    addresses: { algorand: HD_TEST_ADDRESS },
                })
            })
        }

        const sendEther = () => {
            useAccountsStore
                .getState()
                .setAccounts([
                    SENDER_ON_BOTH,
                    ETH_TEST_ACCOUNT,
                    WATCH_ONLY_ACCOUNT,
                ])
            useAccountsStore.getState().setSelectedAccountId(SENDER_ON_BOTH.id)
            useSendFundsStore
                .getState()
                .setSelectedAsset({ chainId: 'ethereum', assetId: 'native' })
            useSendFundsStore.getState().setAmount(new Decimal('0.5'))
        }

        it('Given an ether send, when the picker opens, then it offers the other accounts by their 0x address under the Ethereum placeholder and badge, and never the sender', async () => {
            sendEther()
            seedContacts()

            renderWithNavigation(SelectDestinationScreen, 'SelectDestination')

            const row = await screen.findByTestId(
                `account_result_row_${RECEIVER}`,
            )
            expect(row.textContent).toContain('ETH Test')
            expect(row.textContent).toContain(RECEIVER.slice(0, 6))
            expect(row.textContent).not.toContain(HD_TEST_ADDRESS.slice(0, 6))
            expect(row.textContent).toContain(chainDisplayNameOf('ethereum'))
            expect(
                screen.queryByTestId(`account_result_row_${SENDER}`),
            ).toBeNull()
            expect(screen.queryByText('Watch only')).toBeNull()
            // The Ethereum placeholder is what finds the field at all.
            const fields = screen.getAllByPlaceholderText(
                'address_entry.search_placeholder_evm',
            )
            expect(fields.length).toBeGreaterThan(0)
            fireEvent.change(fields[fields.length - 1], {
                target: { value: 'friend' },
            })

            await waitFor(() =>
                expect(screen.getByText('Eth friend')).toBeTruthy(),
            )
            expect(screen.queryByText('Algo friend')).toBeNull()
        })

        it("Given an ether send to one of the user's accounts, when the user reviews it, then the review shows the network chip and badges, the recipient by name with its 0x address underneath, and the sender by its 0x address", async () => {
            sendEther()
            useSendFundsStore.getState().setDestination(RECEIVER)
            useSendFundsStore.getState().setSendMode('normal')

            renderSendConfirmationStack()

            const chip = await screen.findByTestId('send_confirm_network')
            expect(chip.textContent).toContain(chainDisplayNameOf('ethereum'))
            expect(
                screen.getAllByTestId('chain_avatar_badge_ethereum'),
            ).toHaveLength(2)
            const recipient = screen.getByTestId('send_confirm_recipient')
            expect(recipient.textContent).toContain('ETH Test')
            expect(recipient.textContent).toContain(RECEIVER.slice(0, 6))
            expect(recipient.textContent).not.toContain(RECEIVER)
            const sender = screen
                .getByText('Eth sender')
                .closest('div')?.parentElement
            expect(sender?.textContent).toContain(SENDER.slice(0, 6))
            expect(sender?.textContent).not.toContain(
                ALGO25_TEST_ADDRESS.slice(0, 6),
            )
        })

        it('Given a review, when the user taps the recipient, then the full address opens with a copy action', async () => {
            sendEther()
            useSendFundsStore.getState().setDestination(RECEIVER)
            useSendFundsStore.getState().setSendMode('normal')

            renderSendConfirmationStack()

            fireEvent.click(await screen.findByTestId('send_confirm_recipient'))

            const full = await screen.findByTestId(
                'send_confirm_recipient_full_address',
            )
            expect(full.textContent).toBe(RECEIVER)
            expect(
                screen.getByTestId('send_confirm_recipient_copy'),
            ).toBeTruthy()
        })

        it('Given an ether send to an address the user does not know, when the user reviews it, then the recipient is the full address with the network badge', async () => {
            sendEther()
            useSendFundsStore.getState().setDestination(UNKNOWN_RECIPIENT)
            useSendFundsStore.getState().setSendMode('normal')

            renderSendConfirmationStack()

            const recipient = await screen.findByTestId(
                'send_confirm_recipient',
            )
            expect(within(recipient).getByText(UNKNOWN_RECIPIENT)).toBeTruthy()
            expect(
                within(recipient).getByTestId('chain_avatar_badge_ethereum'),
            ).toBeTruthy()
        })
    })
})
