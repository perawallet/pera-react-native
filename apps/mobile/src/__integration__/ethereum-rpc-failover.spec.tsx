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

// With the first of a network's RPC URLs down, the same flows run on the
// second: an account's balance loads and a send is broadcast.

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
import { Decimal } from 'decimal.js'
import {
    accountsChainAdapters,
    useAccountChainStateStore,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import {
    DEFAULT_EVM_RPC_RESPONSES,
    evmRpcHandlers,
} from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { kmsCore } from '@perawallet/wallet-core-kms'
import { useSettingsStore } from '@perawallet/wallet-core-settings'
import { server } from '@test-utils/msw-server'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { UserPreferences } from '@constants/user-preferences'
import { useSendFundsStore } from '@modules/transactions'
import { TransactionConfirmationScreen } from '@modules/transactions/screens/send-funds/TransactionConfirmationScreen/TransactionConfirmationScreen'
import { TransactionProcessingScreen } from '@modules/transactions/screens/send-funds/TransactionProcessingScreen/TransactionProcessingScreen'
import { TransactionSuccessScreen } from '@modules/transactions/routes'
import {
    confirmSend,
    ETH_SCOPE,
    ETHEREUM_SENDER,
    RECEIVER,
    renderSendConfirmationStack,
    seedEthereumAssets,
    seedSenderEther,
    selectSender,
    SENDER,
    signWithSenderKey,
} from './__fixtures__/ethereum-send'

const DOWN_RPC_URL = 'https://down.rpc.test/'
const RPC_URL = 'https://mainnet.rpc.test/'

// The integration setup registers whichever chains config enables, and hands
// each chain the endpoints config gives it: here the first URL is the dead one.
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
                ? {
                      mainnet: [
                          'https://down.rpc.test/',
                          'https://mainnet.rpc.test/',
                      ],
                      sepolia: [
                          'https://down.rpc.test/',
                          'https://mainnet.rpc.test/',
                      ],
                  }
                : actual.chainEndpointsFor(chainId),
    }
})

describe('Flow: Ethereum with its first RPC URL unreachable', () => {
    const downRequests = vi.fn()
    const sentRawTransactions: string[] = []

    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        useAccountsStore.getState().setAccounts([])
        useAccountChainStateStore.getState().resetState()
        useSendFundsStore.getState().reset()
        useSettingsStore.getState().resetState()
        useSettingsStore
            .getState()
            .setPreference(UserPreferences.transactionInfoAgreed, true)
        downRequests.mockClear()
        sentRawTransactions.length = 0
        server.use(
            http.post(DOWN_RPC_URL, () => {
                downRequests()
                return HttpResponse.error()
            }),
            ...evmRpcHandlers({
                rpcUrl: RPC_URL,
                responses: {
                    eth_getBalance: '0xde0b6b3a7640000',
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

    it("Given the first RPC URL is unreachable, when an account's state is read, then the balance loads from the second", async () => {
        const snapshot = await accountsChainAdapters
            .get('ethereum')
            .fetchAccountState(SENDER, ETH_SCOPE, {
                priorChainState: undefined,
            })

        expect(snapshot.nativeBalanceBaseUnits).toEqual(new Decimal(10).pow(18))
        expect(downRequests).toHaveBeenCalled()
    })

    it('Given the first RPC URL is unreachable, when the user confirms an ether send, then it is broadcast through the second', async () => {
        await seedEthereumAssets()
        await seedSenderEther('10000000000000000000')
        vi.spyOn(kmsCore, 'sign').mockImplementation(signWithSenderKey)
        selectSender(ETHEREUM_SENDER)
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'ethereum', assetId: 'native' })
        useSendFundsStore.getState().setAmount(new Decimal('0.5'))
        useSendFundsStore.getState().setDestination(RECEIVER)
        useSendFundsStore.getState().setSendMode('normal')

        renderSendConfirmationStack({
            confirmation: TransactionConfirmationScreen,
            processing: TransactionProcessingScreen,
            success: TransactionSuccessScreen,
        })
        await confirmSend()

        expect(sentRawTransactions).toHaveLength(1)
        expect(downRequests).toHaveBeenCalled()
    })
})
