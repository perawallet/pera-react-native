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

// @vitest-environment node
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { generateAccount } from 'algosdk'
import { setupServer } from 'msw/node'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    scopeForLegacyNetwork,
    type AssetRef,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { transferContractTests } from '@perawallet/wallet-core-transactions/testing'
import { mockAlgodTransactionParams } from '../../test-handlers'
import { algorandTransferAdapter } from '../adapter'

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
const ALGO: AssetRef = { chainId: 'algorand' as ChainId, assetId: '0' }
const USDC: AssetRef = { chainId: 'algorand' as ChainId, assetId: '31566704' }

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

transferContractTests(() => algorandTransferAdapter, {
    context: { scope: scopeForLegacyNetwork('testnet') },
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
    arrange: () => {
        useAccountsStore.setState({ accounts: [] })
        server.use(mockAlgodTransactionParams())
    },
})
