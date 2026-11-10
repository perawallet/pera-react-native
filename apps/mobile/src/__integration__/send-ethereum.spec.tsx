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

// Real English resources: these flows assert the copy the user reads, not keys.
import '../i18n'

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
import i18n from 'i18next'
import { Notifier } from 'react-native-notifier'

import {
    addAccountToken,
    fetchAndPersistAccount,
    insertAssetHolding,
    useAccountChainStateStore,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    fetchAndPersistAssets,
    nativeAssetFor,
} from '@perawallet/wallet-core-assets'
import {
    chainDisplayNameOf,
    getChainDescriptor,
} from '@perawallet/wallet-core-chain-shared'
import { useContacts } from '@perawallet/wallet-core-contacts'
import {
    DEFAULT_EVM_RPC_RESPONSES,
    erc20CallResponder,
    EvmRpcErrorFixture,
    evmRpcHandlers,
    type EvmRpcResponder,
} from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { kmsCore } from '@perawallet/wallet-core-kms'
import { http, HttpResponse, server } from '@test-utils/msw-server'
import { navigationRef } from '@routes/navigationRef'
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
import { TransactionSuccessScreen } from '@modules/transactions/routes'
import { SelectDestinationScreen } from '@modules/transactions/screens/send-funds/SelectDestinationScreen/SelectDestinationScreen'
import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'
import {
    ALGORAND_SENDER,
    confirmSend,
    ETH_SCOPE,
    ETHEREUM_SENDER,
    RECEIVER,
    renderSendConfirmationStack as renderConfirmationStack,
    seedEthereumAssets,
    seedSenderEther,
    selectSender,
    sentRecord,
    signWithSenderKey,
    SENDER,
    TOKEN,
    UNKNOWN_RECIPIENT,
    UNLISTED_TOKEN,
} from './__fixtures__/ethereum-send'
import {
    recordAnalyticsEvents,
    type AnalyticsRecorder,
} from '@test-utils/analytics-recorder'
import { AnalyticsMetadataKey, TransactionsEvent } from '@analytics'
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
                ? { mainnet: [RPC_URL], sepolia: [RPC_URL] }
                : actual.chainEndpointsFor(chainId),
    }
})

const renderSendConfirmationStack = () =>
    renderConfirmationStack({
        confirmation: TransactionConfirmationScreen,
        processing: TransactionProcessingScreen,
        success: TransactionSuccessScreen,
    })

// A node that never answers: the connection drops before any JSON-RPC reply.
const dropRpc = (shouldDrop: (methods: string[]) => boolean) =>
    http.post(RPC_URL, async ({ request }) => {
        const body: unknown = await request.clone().json()
        const calls = Array.isArray(body) ? body : [body]
        const methods = calls.map(call => String(call?.method))
        if (shouldDrop(methods)) return HttpResponse.error()
        return undefined
    })

const expectEthereumSuccessCopy = () => {
    const result = screen.getByTestId('send_success').textContent ?? ''
    expect(result).toContain(
        'Your transaction was sent to the Ethereum network and is waiting for confirmation.',
    )
    expect(result).not.toContain('Algorand')
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
    // The screen on show while the node receives the broadcast.
    const screenAtBroadcast: string[] = []
    const recordSentRawTransaction = (params: readonly unknown[]) => {
        sentRawTransactions.push(params[0] as string)
        screenAtBroadcast.push(document.body.textContent ?? '')
        const respond = DEFAULT_EVM_RPC_RESPONSES.eth_sendRawTransaction
        return typeof respond === 'function' ? respond(params) : respond
    }

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
        screenAtBroadcast.length = 0
        vi.spyOn(kmsCore, 'sign').mockImplementation(signWithSenderKey)
        server.use(
            ...evmRpcHandlers({
                rpcUrl: RPC_URL,
                responses: {
                    eth_sendRawTransaction: recordSentRawTransaction,
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
            screen.getByText(i18n.t('send_funds.success.pending_title')),
        ).toBeTruthy()
        expect(
            screen.getByText(
                i18n.t('send_funds.success.view_on_explorer', {
                    explorer: getChainDescriptor('ethereum').explorer.name,
                }),
            ),
        ).toBeTruthy()
        expect(sentRawTransactions).toHaveLength(1)
        expect(screenAtBroadcast[0]).toContain(
            'Your transaction is being sent to the Ethereum network.',
        )
        expectEthereumSuccessCopy()
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

    it('Given an ether send, when the node refuses it as an underpriced replacement, then the flow returns to Confirm and records the failure with its EVM code', async () => {
        selectSender(ETHEREUM_SENDER)
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'ethereum', assetId: 'native' })
        useSendFundsStore.getState().setAmount(new Decimal('0.5'))
        useSendFundsStore.getState().setDestination(RECEIVER)
        useSendFundsStore.getState().setSendMode('normal')
        server.use(
            ...evmRpcHandlers({
                rpcUrl: RPC_URL,
                responses: {
                    eth_sendRawTransaction: new EvmRpcErrorFixture(
                        -32_000,
                        'replacement transaction underpriced',
                    ),
                },
            }),
        )

        renderSendConfirmationStack()
        fireEvent.click(
            await findEnabledByTestId('send_confirm_button', { timeout: 5000 }),
        )

        await waitFor(
            () => expect(Notifier.showNotification).toHaveBeenCalled(),
            { timeout: 10_000 },
        )
        await waitFor(() =>
            expect(screen.getByTestId('send_confirm_button')).toBeTruthy(),
        )
        expectFlowEvents(analytics, 'sendFailed', 'ethereum')
        expect(
            analytics.events([TransactionsEvent.Failed])[0]?.payload,
        ).toMatchObject({
            [AnalyticsMetadataKey.ErrorCode]: 'evm.replacement_underpriced',
            [AnalyticsMetadataKey.IsRetryable]: false,
        })
    })

    it('Given an ether send whose broadcast gets no answer, when the user confirms, then the status-unknown notice shows, the flow leaves for History and the send stays on record', async () => {
        selectSender(ETHEREUM_SENDER)
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'ethereum', assetId: 'native' })
        useSendFundsStore.getState().setAmount(new Decimal('0.5'))
        useSendFundsStore.getState().setDestination(RECEIVER)
        useSendFundsStore.getState().setSendMode('normal')
        server.use(
            dropRpc(methods => methods.includes('eth_sendRawTransaction')),
        )
        // The send sheet is not under a real root navigator in this harness.
        vi.spyOn(navigationRef, 'isReady').mockReturnValue(true)
        const navigate = vi
            .spyOn(navigationRef, 'navigate')
            .mockImplementation(() => undefined)

        renderSendConfirmationStack()
        fireEvent.click(
            await findEnabledByTestId('send_confirm_button', { timeout: 5000 }),
        )

        await waitFor(
            () =>
                expect(Notifier.showNotification).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: i18n.t(
                            'errors.submission.unknown_outcome.title',
                        ),
                    }),
                ),
            { timeout: 10_000 },
        )
        expect(navigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Home',
            params: {
                screen: 'AccountDetails',
                pop: true,
                params: { tab: 'History' },
            },
        })
        expect(screen.queryByTestId('send_confirm_button')).toBeNull()
        expect(await sentRecord()).toBeDefined()
    })

    it('Given an ether send whose node cannot be reached while it builds, when the user confirms, then the unreachable notice shows and the flow returns to Confirm', async () => {
        selectSender(ETHEREUM_SENDER)
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'ethereum', assetId: 'native' })
        useSendFundsStore.getState().setAmount(new Decimal('0.5'))
        useSendFundsStore.getState().setDestination(RECEIVER)
        useSendFundsStore.getState().setSendMode('normal')
        renderSendConfirmationStack()
        const confirm = await findEnabledByTestId('send_confirm_button', {
            timeout: 5000,
        })
        // Only the build reads the nonce; the review's fee estimate did not.
        server.use(
            dropRpc(methods => methods.includes('eth_getTransactionCount')),
        )

        fireEvent.click(confirm)

        await waitFor(
            () =>
                expect(Notifier.showNotification).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: i18n.t('errors.evm.network_unreachable.title'),
                    }),
                ),
            { timeout: 10_000 },
        )
        await waitFor(() =>
            expect(screen.getByTestId('send_confirm_button')).toBeTruthy(),
        )
        expect(
            analytics.events([TransactionsEvent.Failed])[0]?.payload,
        ).toMatchObject({
            [AnalyticsMetadataKey.ErrorCode]: 'evm.network_unreachable',
            [AnalyticsMetadataKey.IsRetryable]: true,
        })
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

    const reviewEtherSendWithGasEstimate = (
        eth_estimateGas: EvmRpcResponder<'eth_estimateGas'>,
    ) => {
        server.use(
            ...evmRpcHandlers({
                rpcUrl: RPC_URL,
                responses: {
                    eth_estimateGas,
                    eth_sendRawTransaction: recordSentRawTransaction,
                },
            }),
        )
        selectSender(ETHEREUM_SENDER)
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'ethereum', assetId: 'native' })
        useSendFundsStore.getState().setAmount(new Decimal('0.5'))
        useSendFundsStore.getState().setDestination(RECEIVER)
        useSendFundsStore.getState().setSendMode('normal')
        renderSendConfirmationStack()
    }

    it('Given a node that refuses the gas estimate for the balance, when the user reviews the send, then the review names the shortfall, offers no retry and Confirm stays off', async () => {
        reviewEtherSendWithGasEstimate(
            new EvmRpcErrorFixture(
                -32_000,
                'insufficient funds for gas * price + value',
            ),
        )

        const notice = await screen.findByTestId('send_fee_error', undefined, {
            timeout: 5000,
        })
        expect(notice.textContent).toContain('Insufficient ETH')
        expect(screen.queryByTestId('send_fee_retry_button')).toBeNull()
        const confirm = screen.getByTestId('send_confirm_button')
        expect(isElementDisabled(confirm)).toBe(true)
        fireEvent.click(confirm)
        expect(screen.queryByTestId('send_success')).toBeNull()
        expect(sentRawTransactions).toHaveLength(0)
    })

    it('Given a gas estimate that fails for no stated reason, when the user retries and the node answers, then the fee loads and Confirm sends', async () => {
        let isNodeDown = true
        reviewEtherSendWithGasEstimate(() =>
            isNodeDown
                ? new EvmRpcErrorFixture(-32_603, 'internal error')
                : '0x5208',
        )

        const notice = await screen.findByTestId('send_fee_error', undefined, {
            timeout: 5000,
        })
        expect(notice.textContent).toContain("Couldn't estimate the fee")
        expect(
            isElementDisabled(screen.getByTestId('send_confirm_button')),
        ).toBe(true)
        isNodeDown = false
        fireEvent.click(screen.getByTestId('send_fee_retry_button'))

        await confirmSend()

        expect(screen.queryByTestId('send_fee_error')).toBeNull()
        expect(sentRawTransactions).toHaveLength(1)
    })

    // 1 gwei base fee; tips of 1, 2 and 3 gwei for slow, normal and fast.
    const serveTieredFeeHistory = () => {
        const GWEI = '0x3b9aca00'
        const TIPS: `0x${string}`[] = ['0x3b9aca00', '0x77359400', '0xb2d05e00']
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
                    eth_sendRawTransaction: recordSentRawTransaction,
                },
            }),
        )
    }

    describe('a MAX ether send', () => {
        const TEN_ETHER = new Decimal('10000000000000000000')

        beforeEach(() => {
            serveTieredFeeHistory()
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

    it('Given an ether send, when the user reviews it, then the fee shows Normal in one row, opens to each speed with its wait, and picking one closes it', async () => {
        selectSender(ETHEREUM_SENDER)
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'ethereum', assetId: 'native' })
        useSendFundsStore.getState().setAmount(new Decimal('0.5'))
        useSendFundsStore.getState().setDestination(RECEIVER)
        useSendFundsStore.getState().setSendMode('normal')

        renderSendConfirmationStack()

        const toggle = await screen.findByTestId('fee_preset_toggle')
        expect(toggle.textContent).toContain('Normal')
        expect(screen.queryByTestId('fee_preset_slow')).toBeNull()
        expect(screen.getByTestId('fee_max_info')).toBeTruthy()

        fireEvent.click(toggle)

        for (const preset of ['slow', 'normal', 'fast']) {
            expect(
                await screen.findByTestId(`fee_preset_${preset}_wait`),
            ).toBeTruthy()
        }
        const total = await screen.findByTestId('send_confirm_total')
        await waitFor(() => expect(total.textContent).toMatch(/0\.5\d*[1-9]/))
        expect(screen.queryByTestId('send_fee_shortfall')).toBeNull()

        fireEvent.click(screen.getByTestId('fee_preset_slow'))

        await waitFor(() =>
            expect(useSendFundsStore.getState().feePreset).toBe('slow'),
        )
        expect(screen.queryByTestId('fee_preset_fast')).toBeNull()
        expect(screen.getByTestId('fee_preset_toggle').textContent).toContain(
            'Slow',
        )
    })

    it('Given an ether send, when the user opens the fee, picks Fast and confirms, then the node gets a transaction priced at Fast', async () => {
        serveTieredFeeHistory()
        selectSender(ETHEREUM_SENDER)
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'ethereum', assetId: 'native' })
        useSendFundsStore.getState().setAmount(new Decimal('0.5'))
        useSendFundsStore.getState().setDestination(RECEIVER)
        useSendFundsStore.getState().setSendMode('normal')

        renderSendConfirmationStack()
        fireEvent.click(await screen.findByTestId('fee_preset_toggle'))
        fireEvent.click(await screen.findByTestId('fee_preset_fast'))
        await confirmSend()

        expect(sentRawTransactions).toHaveLength(1)
        // 21000 gas at 2 x 1 gwei base fee plus the 3 gwei Fast tip; Normal would be 84000 gwei.
        expect((await sentRecord())?.fee?.toFixed()).toBe('105000000000000')
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
        expectEthereumSuccessCopy()
        expect((await sentRecord())?.summary).toMatchObject({
            kind: 'token-transfer',
            counterparty: RECEIVER,
            amount: {
                assetRef: { chainId: 'ethereum', assetId: TOKEN },
                value: new Decimal(12_500_000),
            },
        })
    })

    it('Given a token no Pera list names that the account added and holds, when the user sends 12.5 of it, then a token transfer call to its contract reaches the node', async () => {
        server.use(
            ...evmRpcHandlers({
                rpcUrl: RPC_URL,
                responses: {
                    eth_getBalance: '0x8ac7230489e80000',
                    eth_call: erc20CallResponder({
                        [UNLISTED_TOKEN]: {
                            name: 'Unlisted Token',
                            symbol: 'UNL',
                            decimals: 6,
                            totalSupply: 1_000_000_000_000n,
                            balances: { [SENDER]: 25_000_000n },
                        },
                    }),
                    eth_sendRawTransaction: recordSentRawTransaction,
                },
            }),
        )
        // With no Pera services, the metadata and balance come from the chain
        // alone, as the background sync reads them for an added token.
        await fetchAndPersistAssets([UNLISTED_TOKEN], ETH_SCOPE)
        await addAccountToken({
            accountAddress: SENDER,
            scope: ETH_SCOPE,
            assetId: UNLISTED_TOKEN,
        })
        await fetchAndPersistAccount(SENDER, ETH_SCOPE)
        selectSender(ETHEREUM_SENDER)
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'ethereum', assetId: UNLISTED_TOKEN })
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
                assetRef: { chainId: 'ethereum', assetId: UNLISTED_TOKEN },
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
                    title: i18n.t(
                        'send_funds.destination.invalid_address_title',
                    ),
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
                    title: i18n.t(
                        'send_funds.destination.invalid_address_title',
                    ),
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
                i18n.t('address_entry.search_placeholder_evm'),
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
