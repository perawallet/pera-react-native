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

import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { generateAccount } from 'algosdk'
import { setupServer } from 'msw/node'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    type AssetRef,
    type ChainId,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { transferContractTests } from '@perawallet/wallet-core-transactions/testing'
import { algorandDescriptor } from '../../descriptor'
import { mockAlgodTransactionParams } from '../../test-handlers'
import { algorandTransferAdapter } from '../adapter'

const mocks = vi.hoisted(() => ({ getAccountChainStateRow: vi.fn() }))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    getAccountChainStateRow: mocks.getAccountChainStateRow,
    // The accounts adapter that answers this isn't registered here.
    isDelegatedAccount: () => false,
}))

vi.mock('../address-poisoning', () => ({
    getAlgorandAddressPoisoningRules: () => ({
        lookalikeMatchedChars: 4,
        dustCeiling: new Decimal(1000),
    }),
}))
vi.mock('../../blockchain/fees/getMinimumFeeConfig', () => ({
    getMinimumFeeConfig: () => ({
        minTxnFee: 1000n,
        pqMultiplier: 3n,
        assetMbr: 100_000n,
        baseAccountMbr: 100_000n,
    }),
}))

const SENDER = generateAccount().addr.toString()
const RECEIVER = generateAccount().addr.toString()
const SENDER_ACCOUNT: WalletAccount = {
    id: 'sender',
    custody: { kind: 'watch' },
    chains: { algorand: { address: SENDER } },
}
const NATIVE_BALANCE = new Decimal(5_000_000)
const ALGO: AssetRef = { chainId: 'algorand' as ChainId, assetId: '0' }
const USDC: AssetRef = { chainId: 'algorand' as ChainId, assetId: '31566704' }

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

transferContractTests(() => algorandTransferAdapter, {
    context: {
        scope: { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const,
    },
    nativeTransfer: {
        kind: 'transfer',
        from: SENDER,
        to: RECEIVER,
        assetRef: ALGO,
        amount: new Decimal(1_000_000),
    },
    tokenTransfer: {
        kind: 'transfer',
        from: SENDER,
        to: RECEIVER,
        assetRef: USDC,
        amount: new Decimal(250),
    },
    assetOptIn: { kind: 'asset-opt-in', account: SENDER, assetRef: USDC },
    spendable: {
        account: SENDER_ACCOUNT,
        nativeBalance: NATIVE_BALANCE,
        fee: new Decimal(1_000),
        hasReserve: true,
    },
    supportsReplacement: algorandDescriptor.protocol.supportsReplacement,
    arrange: () => {
        useAccountsStore.setState({ accounts: [] })
        mocks.getAccountChainStateRow.mockResolvedValue({
            accountAddress: SENDER,
            nativeBalance: NATIVE_BALANCE,
            chainData: {
                family: 'algorand',
                minBalance: new Decimal(100_000),
                status: 'Offline',
                totalAssetsOptedIn: 0,
                totalCreatedAssets: 0,
                totalAppsOptedIn: 0,
            },
        })
        server.use(mockAlgodTransactionParams())
    },
})
