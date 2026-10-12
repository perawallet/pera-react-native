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

import { vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { http, HttpResponse, type RequestHandler } from 'msw'
import type { Hex } from 'viem'
import {
    accountStateContractTests,
    type AccountStateContractFixtures,
} from '@perawallet/wallet-core-accounts/testing/account-state'
import { accountsContractTests } from '@perawallet/wallet-core-accounts/testing'
import {
    DerivationTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    ChainContext,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { createEthereumAccountStateOps } from '../account-state'
import { createEthereumAccountsAdapter } from '../adapter'
import { ethereumAddressCodec } from '../address-codec'
import { evmRpcHandlers } from '../../blockchain/msw-handlers'
import { peraEvmHandlers } from '../msw-handlers'
import { PERA_URL } from '../../__tests__/pera-backend'

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
    ),
)

const RPC_URL = 'https://mainnet.rpc.test/'
const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

const FUNDED: Hex = '0x00000000000000000000000000000000000000aa'
const EMPTY: Hex = '0x00000000000000000000000000000000000000bb'
// 2.5 ETH in wei.
const FUNDED_WEI: Hex = '0x22b1c8c1227a0000'
const CURSOR = 100

const contextWith = (services: readonly string[]): ChainContext => ({
    getScope: () => SCOPE,
    getEndpoints: () => ({ mainnet: RPC_URL }),
    getPeraBackend: () => ({
        baseUrl: services.length > 0 ? PERA_URL : '',
        services: new Set(services),
    }),
    timeouts: { readMs: 1_000, submitMs: 1_000 },
    kms: {} as ChainContext['kms'],
})

const accountsRpc = (blockNumber: Hex = '0x64'): RequestHandler[] =>
    evmRpcHandlers({
        rpcUrl: RPC_URL,
        responses: {
            eth_blockNumber: blockNumber,
            eth_getBalance: ([address]) =>
                address === FUNDED ? FUNDED_WEI : '0x0',
            eth_getTransactionCount: ([address, tag]) => {
                if (address !== FUNDED) return '0x0'
                return tag === 'pending' ? '0x4' : '0x3'
            },
        },
    })

const rpcFailure: RequestHandler[] = [
    http.post(RPC_URL, () => HttpResponse.json({}, { status: 503 })),
]

const sharedFixtures: Omit<AccountStateContractFixtures, 'changeSignal'> = {
    scope: SCOPE,
    codec: ethereumAddressCodec,
    funded: {
        address: FUNDED,
        handlers: accountsRpc(),
        nativeAssetId: 'native',
        nativeBalanceBaseUnits: new Decimal('2500000000000000000'),
    },
    empty: { address: EMPTY, handlers: accountsRpc() },
    activity: { active: FUNDED, inactive: EMPTY, handlers: accountsRpc() },
    activityFailure: rpcFailure,
}

// The change-signal handlers serve only the source under test, so reaching
// the other one fails on the unhandled request.
accountStateContractTests(
    () => createEthereumAccountStateOps(contextWith([])),
    {
        ...sharedFixtures,
        changeSignal: {
            addresses: [FUNDED],
            cursor: CURSOR,
            changed: {
                handlers: evmRpcHandlers({
                    rpcUrl: RPC_URL,
                    responses: { eth_blockNumber: '0x65' },
                }),
                nextCursor: 101,
            },
            unchanged: {
                handlers: evmRpcHandlers({
                    rpcUrl: RPC_URL,
                    responses: { eth_blockNumber: '0x64' },
                }),
                nextCursor: CURSOR,
            },
        },
    },
    'JSON-RPC block number',
)

const signing: WalletAccount = {
    id: 'signing',
    address: FUNDED,
    custody: { kind: 'local', seed: null },
    keyPairId: 'signing-key',
}

const watch: WalletAccount = {
    id: 'watch',
    address: EMPTY,
    custody: { kind: 'watch' },
}

accountsContractTests(
    () => createEthereumAccountsAdapter(contextWith(['blockFollowing'])),
    {
        ...sharedFixtures,
        hdPath: {
            details: {
                account: 1,
                change: 0,
                keyIndex: 3,
                derivationType: DerivationTypes.Peikert,
            },
            matching: "m/44'/60'/1'/0/3",
            mismatched: "m/44'/60'/1'/0/4",
            malformed: "m/44'/283'/1'/0/3",
        },
        signers: { signing, watch },
        changeSignal: {
            addresses: [FUNDED],
            cursor: CURSOR,
            changed: {
                handlers: peraEvmHandlers({
                    baseUrl: PERA_URL,
                    blockFollowing: { refresh: true, block: 105 },
                }),
                nextCursor: 105,
            },
            unchanged: {
                handlers: peraEvmHandlers({
                    baseUrl: PERA_URL,
                    blockFollowing: { refresh: false, block: 105 },
                }),
                nextCursor: 105,
            },
        },
    },
)
