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

// One account on Algorand and Ethereum holding USDC on both, whose synced
// metadata names the same cross-chain group.

import { Decimal } from 'decimal.js'
import {
    insertAssetHolding,
    upsertAccountChainState,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    nativeAssetFor,
    upsertAssetPrices,
    upsertAssets,
    type AssetGroup,
} from '@perawallet/wallet-core-assets'
import {
    type ChainScope,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import {
    seedAlgoAsset,
    seedAlgorandAccountState,
} from '@test-utils/database-setup'
import { USDC_TEST_ASSET } from './assets'
import { ALGO25_TEST_ADDRESS } from './onboarding'

export const ETH_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
export const ETH_SCOPE: ChainScope = {
    chainId: 'ethereum',
    networkId: 'mainnet',
}
export const ALGO_SCOPE: ChainScope = {
    chainId: LEGACY_CHAIN_ID,
    networkId: 'mainnet',
}

export const ETH_USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
// Calls itself USDC, but no group names it.
export const LOOKALIKE = '0x1111111111111111111111111111111111111111'

export const TWO_CHAIN_ACCOUNT: WalletAccount = {
    id: 'two-chains',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'a-key' },
        ethereum: { address: ETH_ADDRESS, keyPairId: 'e-key' },
    },
    name: 'Both chains',
}

export const USDC_GROUP: AssetGroup = {
    id: 'usdc',
    name: 'USD Coin',
    symbol: 'USDC',
}

// 10 ALGO and 2.5 USDC on Algorand; 1.5 ETH, 1.5 USDC and 7 of the lookalike
// on Ethereum.
export const seedHoldings = async () => {
    await seedAlgoAsset('mainnet')
    await upsertAssets({
        items: [
            {
                ...USDC_TEST_ASSET,
                peraMetadata: {
                    isDeleted: false,
                    verificationTier: 'verified',
                    ...USDC_TEST_ASSET.peraMetadata,
                    crossChainAssetGroup: USDC_GROUP,
                },
            },
        ],
        scope: ALGO_SCOPE,
    })
    await seedAlgorandAccountState({
        accountAddress: ALGO25_TEST_ADDRESS,
        scope: ALGO_SCOPE,
        nativeBalance: new Decimal(10_000_000),
    })
    await insertAssetHolding({
        accountAddress: ALGO25_TEST_ADDRESS,
        assetId: '0',
        scope: ALGO_SCOPE,
        amount: new Decimal('10000000'),
    })
    await insertAssetHolding({
        accountAddress: ALGO25_TEST_ADDRESS,
        assetId: USDC_TEST_ASSET.assetId,
        scope: ALGO_SCOPE,
        amount: new Decimal('2500000'),
    })

    const ether = nativeAssetFor('ethereum')
    await upsertAssets({
        items: [
            ether,
            {
                ...ether,
                assetId: ETH_USDC,
                name: 'USD Coin',
                unitName: 'USDC',
                decimals: 6,
                peraMetadata: {
                    isDeleted: false,
                    verificationTier: 'verified',
                    crossChainAssetGroup: USDC_GROUP,
                },
            },
            {
                ...ether,
                assetId: LOOKALIKE,
                name: 'USD Coin',
                unitName: 'USDC',
                decimals: 6,
            },
        ],
        scope: ETH_SCOPE,
    })
    await upsertAccountChainState({
        accountAddress: ETH_ADDRESS,
        scope: ETH_SCOPE,
        nativeBalance: new Decimal('1500000000000000000'),
        chainData: { family: 'evm', nonce: { latest: 0, pending: 0 } },
    })
    for (const [assetId, amount] of [
        [ether.assetId, '1500000000000000000'],
        [ETH_USDC, '1500000'],
        [LOOKALIKE, '7000000'],
    ] as const) {
        await insertAssetHolding({
            accountAddress: ETH_ADDRESS,
            assetId,
            scope: ETH_SCOPE,
            amount: new Decimal(amount),
        })
    }
    await upsertAssetPrices({
        prices: [
            { assetId: '0', usdPrice: new Decimal('0.30') },
            { assetId: USDC_TEST_ASSET.assetId, usdPrice: new Decimal('1') },
        ],
        scope: ALGO_SCOPE,
    })
    await upsertAssetPrices({
        prices: [
            { assetId: ether.assetId, usdPrice: new Decimal('2000') },
            { assetId: ETH_USDC, usdPrice: new Decimal('1') },
        ],
        scope: ETH_SCOPE,
    })
}
