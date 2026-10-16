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
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Notifier } from 'react-native-notifier'

import {
    useAccountChainStateStore,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { nativeAssetFor, upsertAssets } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    DEFAULT_EVM_RPC_RESPONSES,
    evmRpcHandlers,
} from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { kmsCore, SeedScheme } from '@perawallet/wallet-core-kms'
import { getPendingTransactionRecords } from '@perawallet/wallet-core-transactions'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { isElementDisabled } from '@test-utils/rnw'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { useSendFundsStore } from '@modules/transactions'
import { TransactionConfirmationScreen } from '@modules/transactions/screens/send-funds/TransactionConfirmationScreen/TransactionConfirmationScreen'
import { TransactionProcessingScreen } from '@modules/transactions/screens/send-funds/TransactionProcessingScreen/TransactionProcessingScreen'
import { SelectDestinationScreen } from '@modules/transactions/screens/send-funds/SelectDestinationScreen/SelectDestinationScreen'
import { TransactionSuccessScreen } from '@modules/transactions/routes'
import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'

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
    await waitFor(
        () => expect(screen.getByTestId('send_confirm_button')).toBeTruthy(),
        { timeout: 5000 },
    )
    const confirmButton = screen.getByTestId('send_confirm_button')
    await waitFor(() => expect(isElementDisabled(confirmButton)).toBe(false))
    fireEvent.click(confirmButton)
    await waitFor(
        () => expect(screen.getByTestId('send_success')).toBeTruthy(),
        { timeout: 10_000 },
    )
}

describe('Flow: send from an Ethereum account', () => {
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
        useAccountsStore.getState().setAccounts([])
        useAccountChainStateStore.getState().resetState()
        useSendFundsStore.getState().reset()
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
        useSendFundsStore.getState().setSelectedAssetId('native')
        useSendFundsStore.getState().setAmount(new Decimal('0.5'))
        useSendFundsStore.getState().setDestination(RECEIVER)
        useSendFundsStore.getState().setSendMode('normal')

        renderSendConfirmationStack()
        await confirmSend()

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
    })

    it('Given an ERC-20 send, when the user confirms, then a token transfer call reaches the node', async () => {
        selectSender(ETHEREUM_SENDER)
        useSendFundsStore.getState().setSelectedAssetId(TOKEN)
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
        useSendFundsStore.getState().setSelectedAssetId('native')
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
        useSendFundsStore.getState().setSelectedAssetId('0')
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
})
