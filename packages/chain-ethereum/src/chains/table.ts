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

import type {
    EvmChainId,
    NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import { createEvmChain } from './create-evm-chain'
import type { EvmChain, EvmChainRow } from './types'

export const ETHEREUM_CHAIN_ID = 'ethereum' satisfies EvmChainId

const ETHER = { symbol: 'ETH', name: 'Ether', decimals: 18, slip44: '60' }

// The OP-stack predeploy every OP-stack chain puts its GasPriceOracle at.
const OP_STACK_GAS_PRICE_ORACLE = '0x420000000000000000000000000000000000000F'

const GWEI = 1_000_000_000n

export const EVM_CHAIN_ROWS: readonly EvmChainRow[] = [
    {
        id: ETHEREUM_CHAIN_ID,
        displayName: 'Ethereum',
        nativeAsset: ETHER,
        explorerName: 'Etherscan',
        explorerBase: {
            mainnet: 'https://etherscan.io',
            sepolia: 'https://sepolia.etherscan.io',
        },
        fee: { kind: 'eip1559' },
        blockTimeMs: 12_000,
        finality: { kind: 'confirmations', recommended: 12 },
        enabledByDefault: true,
    },
    {
        id: 'base',
        displayName: 'Base',
        nativeAsset: ETHER,
        explorerName: 'Basescan',
        explorerBase: {
            mainnet: 'https://basescan.org',
            sepolia: 'https://sepolia.basescan.org',
        },
        fee: {
            kind: 'eip1559-op-stack',
            gasPriceOracleAddress: OP_STACK_GAS_PRICE_ORACLE,
        },
        blockTimeMs: 2_000,
        finality: { kind: 'confirmations', recommended: 10 },
        enabledByDefault: false,
    },
    {
        id: 'bsc',
        displayName: 'BNB Chain',
        nativeAsset: {
            symbol: 'BNB',
            name: 'BNB',
            decimals: 18,
            slip44: '714',
        },
        explorerName: 'BscScan',
        explorerBase: {
            mainnet: 'https://bscscan.com',
            testnet: 'https://testnet.bscscan.com',
        },
        fee: { kind: 'eip1559' },
        blockTimeMs: 750,
        finality: { kind: 'confirmations', recommended: 15 },
        enabledByDefault: false,
    },
    {
        id: 'arbitrum',
        displayName: 'Arbitrum One',
        nativeAsset: ETHER,
        explorerName: 'Arbiscan',
        explorerBase: {
            mainnet: 'https://arbiscan.io',
            sepolia: 'https://sepolia.arbiscan.io',
        },
        // Arbitrum's estimateGas already prices the L1 calldata into gas.
        fee: { kind: 'eip1559' },
        blockTimeMs: 250,
        finality: { kind: 'confirmations', recommended: 20 },
        enabledByDefault: false,
    },
    {
        id: 'avalanche',
        displayName: 'Avalanche C-Chain',
        nativeAsset: {
            symbol: 'AVAX',
            name: 'Avalanche',
            decimals: 18,
            slip44: '9000',
        },
        explorerName: 'Snowtrace',
        explorerBase: {
            mainnet: 'https://snowtrace.io',
            fuji: 'https://testnet.snowtrace.io',
        },
        fee: { kind: 'eip1559' },
        blockTimeMs: 2_000,
        finality: { kind: 'instant' },
        enabledByDefault: false,
    },
    {
        id: 'polygon',
        displayName: 'Polygon',
        nativeAsset: {
            symbol: 'POL',
            name: 'Polygon Ecosystem Token',
            decimals: 18,
            slip44: '966',
        },
        explorerName: 'Polygonscan',
        explorerBase: {
            mainnet: 'https://polygonscan.com',
            amoy: 'https://amoy.polygonscan.com',
        },
        fee: {
            kind: 'eip1559-min-tip',
            minPriorityFeePerGas: { mainnet: 25n * GWEI, amoy: 25n * GWEI },
        },
        blockTimeMs: 2_000,
        finality: { kind: 'confirmations', recommended: 32 },
        enabledByDefault: false,
    },
]

export const EVM_CHAINS: readonly EvmChain[] =
    EVM_CHAIN_ROWS.map(createEvmChain)

export const evmChainOf = (id: EvmChainId): EvmChain => {
    const chain = EVM_CHAINS.find(({ row }) => row.id === id)
    if (!chain) throw new Error(`${id} has no row in the EVM chain table`)
    return chain
}

export const evmChainOfEip155Id = (
    eip155ChainId: number,
): { chain: EvmChain; networkId: NetworkId } | undefined => {
    for (const chain of EVM_CHAINS) {
        const network = chain.descriptor.networks.find(
            n =>
                n.nativeRef.kind === 'evm' &&
                n.nativeRef.eip155ChainId === eip155ChainId,
        )
        if (network) return { chain, networkId: network.id }
    }
    return undefined
}
