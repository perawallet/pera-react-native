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
import {
    assetMetadataContractTests,
    assetPriceContractTests,
} from '@perawallet/wallet-core-assets/testing/adapter-contract'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { createEthereumAssetsAdapter } from '../adapter'
import { ETHEREUM_NATIVE_ASSET } from '../native-asset'
import { peraEvmAssetHandlers, unknownAssetItem } from '../api/msw-handlers'
import type { AssetItemResponse } from '../api/schema'
import {
    erc20CallResponder,
    evmRpcHandlers,
} from '../../blockchain/msw-handlers'
import {
    TEST_PERA_URL,
    TEST_RPC_URL,
    testChainContext,
} from '../../__tests__/context'

const persisted = vi.hoisted(() => ({ ids: new Set<string>() }))

vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const record = async ({ items }: { items: { assetId: string }[] }) => {
        items.forEach(item => persisted.ids.add(item.assetId))
    }
    return {
        ...(await importOriginal<object>()),
        getStaleOrMissingAssetIds: async ({
            assetIds,
        }: {
            assetIds: string[]
        }) => assetIds,
        upsertAssets: record,
        upsertNodeAssets: record,
    }
})

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
    ),
)

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const USDC_CAIP19 = `eip155:1/erc20:${USDC.toLowerCase()}`
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const DAI_CAIP19 = `eip155:1/erc20:${DAI.toLowerCase()}`
const ETH_CAIP19 = 'eip155:1/slip44:60'

const listed = (caip19: string, unitName: string): AssetItemResponse => ({
    ...unknownAssetItem(caip19),
    type: 'erc20',
    name: unitName,
    unit_name: unitName,
    fraction_decimals: 6,
    is_verified: true,
    verification_tier: 'verified',
})

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
                ...listed(USDC_CAIP19, 'USDC'),
                usd_value: '1.000100000000000000000000',
            },
            [DAI_CAIP19]: listed(DAI_CAIP19, 'DAI'),
            [ETH_CAIP19]: {
                ...unknownAssetItem(ETH_CAIP19),
                usd_value: '2500.120000000000000000000000',
            },
        },
    }),
]

const runMetadata = (services: readonly string[], label: string) =>
    assetMetadataContractTests(
        () => {
            persisted.ids.clear()
            return createEthereumAssetsAdapter(testChainContext({ services }))
        },
        {
            scope: SCOPE,
            nativeAssetId: ETHEREUM_NATIVE_ASSET.assetId,
            token: { assetId: USDC, unitName: 'USDC', decimals: 6 },
            handlers,
            persistedIds: () => [...persisted.ids],
        },
        label,
    )

runMetadata(['assets'], 'Pera assets')
runMetadata([], 'on-chain only')

assetPriceContractTests(
    () =>
        createEthereumAssetsAdapter(
            testChainContext({ services: ['assets', 'prices'] }),
        ),
    {
        scope: SCOPE,
        priced: { assetId: USDC, usdPrice: new Decimal('1.0001') },
        unpricedAssetId: DAI,
        nativeUsdPrice: new Decimal('2500.12'),
        handlers,
    },
    'Pera prices',
)
