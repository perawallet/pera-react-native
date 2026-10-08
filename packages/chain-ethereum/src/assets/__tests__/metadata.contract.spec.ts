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
import { assetMetadataContractTests } from '@perawallet/wallet-core-assets/testing/metadata'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    createEthereumAssetOps,
    type EthereumAssetPersistence,
} from '../metadata'
import { ETHEREUM_NATIVE_ASSET } from '../native-asset'
import { peraEvmAssetHandlers, unknownAssetItem } from '../api/msw-handlers'
import {
    erc20CallResponder,
    evmRpcHandlers,
} from '../../blockchain/msw-handlers'
import {
    TEST_PERA_URL,
    TEST_RPC_URL,
    testChainContext,
} from '../../__tests__/context'

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
    ),
)

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const USDC_CAIP19 = `eip155:1/erc20:${USDC.toLowerCase()}`

const handlers = [
    ...evmRpcHandlers({
        rpcUrl: TEST_RPC_URL,
        responses: {
            eth_call: erc20CallResponder({
                [USDC]: {
                    name: 'USD Coin',
                    symbol: 'USDC',
                    decimals: 6,
                    totalSupply: 10n ** 12n,
                },
            }),
        },
    }),
    ...peraEvmAssetHandlers({
        baseUrl: TEST_PERA_URL,
        assets: {
            [USDC_CAIP19]: {
                ...unknownAssetItem(USDC_CAIP19),
                type: 'erc20',
                name: 'USD Coin',
                unit_name: 'USDC',
                fraction_decimals: 6,
                is_verified: true,
                verification_tier: 'verified',
            },
        },
    }),
]

const run = (services: readonly string[], label: string) => {
    // Fresh per ops instance, so one case's writes cannot satisfy another's.
    let persisted = new Set<string>()
    const makeOps = () => {
        const store = new Set<string>()
        persisted = store
        const record = async ({ items }: { items: { assetId: string }[] }) => {
            items.forEach(item => store.add(item.assetId))
        }
        const persistence: EthereumAssetPersistence = {
            getStaleOrMissingAssetIds: async ({ assetIds }) => assetIds,
            upsertAssets: record,
            upsertNodeAssets: record,
        }
        return createEthereumAssetOps(
            testChainContext({ services }),
            persistence,
        )
    }
    assetMetadataContractTests(
        makeOps,
        {
            scope: SCOPE,
            nativeAssetId: ETHEREUM_NATIVE_ASSET.assetId,
            token: { assetId: USDC, unitName: 'USDC', decimals: 6 },
            handlers,
            persistedIds: () => [...persisted],
        },
        label,
    )
}

run(['assets'], 'Pera assets')
run([], 'on-chain only')
