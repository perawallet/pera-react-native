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
import { getAddress, type Hex } from 'viem'
import {
    accountStateContractTests,
    type AccountStateContractFixtures,
} from '@perawallet/wallet-core-accounts/testing/account-state'
import { accountsContractTests } from '@perawallet/wallet-core-accounts/testing'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { createEthereumAccountStateOps } from '../account-state'
import { createEthereumAccountsAdapter } from '../adapter'
import { createEvmAddressCodec } from '../address-codec'
import {
    erc20CallResponder,
    evmRpcHandlers,
} from '../../blockchain/msw-handlers'
import { peraEvmHandlers } from '../msw-handlers'
import {
    nativeWhitelistItem,
    unknownAssetItem,
} from '../../assets/api/msw-handlers'
import {
    TEST_PERA_URL,
    TEST_RPC_URL,
    testChainContext,
} from '../../__tests__/context'
import {
    eip155IdOf,
    EVM_TEST_CHAINS,
    evmScopeOf,
} from '../../__tests__/evm-chains'
import type { EvmChain } from '../../chains/types'

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
    ),
)

const suites = (chain: EvmChain): void => {
    const SCOPE: ChainScope = evmScopeOf(chain)
    const ID = eip155IdOf(chain)

    const FUNDED: Hex = '0x00000000000000000000000000000000000000aa'
    const EMPTY: Hex = '0x00000000000000000000000000000000000000bb'
    // 2.5 ETH in wei.
    const FUNDED_WEI: Hex = '0x22b1c8c1227a0000'
    const CURSOR = 100

    const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

    const accountsRpc = (blockNumber: Hex = '0x64'): RequestHandler[] =>
        evmRpcHandlers({
            rpcUrl: TEST_RPC_URL,
            responses: {
                eth_call: erc20CallResponder({
                    [USDC]: {
                        name: 'USD Coin',
                        symbol: 'USDC',
                        decimals: 6,
                        totalSupply: 10n ** 12n,
                        balances: { [getAddress(FUNDED)]: 2_500_000n },
                    },
                }),
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
        http.post(TEST_RPC_URL, () => HttpResponse.json({}, { status: 503 })),
    ]

    const sharedFixtures: Omit<AccountStateContractFixtures, 'changeSignal'> = {
        scope: SCOPE,
        codec: createEvmAddressCodec(chain),
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

    const rpcChangeSignal: AccountStateContractFixtures['changeSignal'] = {
        addresses: [FUNDED],
        cursor: CURSOR,
        changed: {
            handlers: evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: { eth_blockNumber: '0x65' },
            }),
            nextCursor: 101,
        },
        unchanged: {
            handlers: evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: { eth_blockNumber: '0x64' },
            }),
            nextCursor: CURSOR,
        },
    }

    // The change-signal handlers serve only the source under test, so reaching
    // the other one fails on the unhandled request.
    accountStateContractTests(
        () => createEthereumAccountStateOps(testChainContext({ chain }), chain),
        { ...sharedFixtures, changeSignal: rpcChangeSignal },
        'JSON-RPC block number',
    )

    const signing: WalletAccount = {
        id: 'signing',
        custody: { kind: 'local', seed: null },
        chains: {
            [chain.row.id]: { address: FUNDED, keyPairId: 'signing-key' },
        },
    }

    const watch: WalletAccount = {
        id: 'watch',
        custody: { kind: 'watch' },
        chains: { [chain.row.id]: { address: EMPTY } },
    }

    accountsContractTests(
        () =>
            createEthereumAccountsAdapter(
                testChainContext({ services: ['blockFollowing'], chain }),
                chain,
            ),
        {
            ...sharedFixtures,
            hdPath: {
                details: { account: 1, keyIndex: 3 },
                matching: "m/44'/60'/1'/0/3",
                mismatched: "m/44'/60'/1'/0/4",
                malformed: "m/44'/283'/1'/0/3",
            },
            signers: { signing, watch },
            // This scope serves no assets or prices, so both answer without a
            // request, the portfolio as no source; balance-history.spec
            // covers the served path.
            history: {
                addresses: [FUNDED],
                assetId: USDC,
                period: 'one-day',
                currency: 'USD',
                handlers: [],
                portfolio: null,
                balance: [],
            },
            changeSignal: {
                addresses: [FUNDED],
                cursor: CURSOR,
                changed: {
                    handlers: peraEvmHandlers({
                        baseUrl: TEST_PERA_URL,
                        blockFollowing: { refresh: true, round: 105 },
                    }),
                    nextCursor: 105,
                },
                // The default answers a null cursor with a refresh, as the
                // backend does, and a set one with none.
                unchanged: {
                    handlers: peraEvmHandlers({ baseUrl: TEST_PERA_URL }),
                    nextCursor: CURSOR,
                },
            },
        },
    )

    accountStateContractTests(
        () =>
            createEthereumAccountStateOps(
                testChainContext({ services: ['assets'], chain }),
                chain,
            ),
        {
            ...sharedFixtures,
            funded: {
                ...sharedFixtures.funded,
                handlers: [
                    ...accountsRpc(),
                    ...peraEvmHandlers({
                        baseUrl: TEST_PERA_URL,
                        whitelist: {
                            [ID]: [
                                nativeWhitelistItem(ID),
                                {
                                    ...unknownAssetItem(
                                        `eip155:${ID}/erc20:${USDC.toLowerCase()}`,
                                    ),
                                    type: 'erc20',
                                    name: 'USD Coin',
                                    unit_name: 'USDC',
                                    fraction_decimals: 6,
                                    is_verified: true,
                                    verification_tier: 'verified',
                                    is_swappable: true,
                                    is_fundable: true,
                                },
                            ],
                        },
                    }),
                ],
                heldAssetId: USDC,
            },
            // The activity check reads the whitelist for a scope with assets.
            activity: {
                ...sharedFixtures.activity,
                handlers: [
                    ...accountsRpc(),
                    ...peraEvmHandlers({ baseUrl: TEST_PERA_URL }),
                ],
            },
            changeSignal: rpcChangeSignal,
        },
        'Pera assets',
    )
}

for (const chain of EVM_TEST_CHAINS) suites(chain)
