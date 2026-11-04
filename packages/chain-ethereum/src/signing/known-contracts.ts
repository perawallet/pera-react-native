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

import { isAddress } from 'viem'
import type { Address } from 'viem'
import type { KnownSpender } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { areEvmAddressesEqual } from '../accounts/address-codec'

export type KnownEvmContractKind =
    | 'uniswap-universal-router'
    | 'uniswap-permit2'
    | 'wrapped-native'
    | 'aave-v3-pool'

export type KnownEvmContract = {
    /** Checksummed. */
    address: Address
    kind: KnownEvmContractKind
    /** A proper noun: shown as written, never translated. */
    name: string
    /** The project's own domain, for matching the requesting site; absent on wrapped native, which no project owns. */
    projectDomain?: string
    /** The published deployment list this address was taken from. */
    source: string
}

const UNISWAP_DOMAIN = 'uniswap.org'
const AAVE_DOMAIN = 'aave.com'

const UNISWAP_DEPLOYMENTS =
    'https://developers.uniswap.org/docs/protocols/v3/deployments'
const ROUTER_DEPLOYMENTS =
    'https://github.com/Uniswap/universal-router/blob/edf19bfde87e6cf5b29046f6ca2f483a4ffd6ae6/deploy-addresses'
const AAVE_ADDRESS_BOOK =
    'https://github.com/bgd-labs/aave-address-book/blob/e8ae93884d30d708fad4f666b52387f7f14f9c1e/src/ts'

// The same CREATE2 address on every chain.
const PERMIT2_ADDRESS: Address = '0x000000000022D473030F116dDEE9F6B43aC78BA3'

const router = (address: Address, source: string): KnownEvmContract => ({
    address,
    kind: 'uniswap-universal-router',
    name: 'Uniswap Universal Router',
    projectDomain: UNISWAP_DOMAIN,
    source,
})

const routerListed = (address: Address, file: string): KnownEvmContract =>
    router(address, `${ROUTER_DEPLOYMENTS}/${file}.json`)

const permit2 = (page: string): KnownEvmContract => ({
    address: PERMIT2_ADDRESS,
    kind: 'uniswap-permit2',
    name: 'Permit2',
    projectDomain: UNISWAP_DOMAIN,
    source: `${UNISWAP_DEPLOYMENTS}/${page}`,
})

const wrappedNative = (
    address: Address,
    name: string,
    page: string,
): KnownEvmContract => ({
    address,
    kind: 'wrapped-native',
    name,
    source: `${UNISWAP_DEPLOYMENTS}/${page}`,
})

const aavePool = (address: Address, file: string): KnownEvmContract => ({
    address,
    kind: 'aave-v3-pool',
    name: 'Aave V3 Pool',
    projectDomain: AAVE_DOMAIN,
    source: `${AAVE_ADDRESS_BOOK}/${file}.ts`,
})

/**
 * Well-known contracts by EIP-155 chain id, mainnets only. Routers are every
 * version in Uniswap's `deploy-addresses` (V1, V1.2, V2, V2.1.1, V2.1.2 where
 * a chain has them); each entry's `source` is where its address was checked.
 */
export const KNOWN_EVM_CONTRACTS: Readonly<
    Record<number, readonly KnownEvmContract[]>
> = {
    1: [
        routerListed('0xEf1c6E67703c7BD7107eed8303Fbe6EC2554BF6B', 'mainnet'),
        routerListed('0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD', 'mainnet'),
        routerListed('0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af', 'mainnet'),
        routerListed('0x4C82D1fBFe28C977cBB58D8C7FF8FCF9F70a2cCA', 'mainnet'),
        routerListed('0x23617e59A5925b2A4Bf75d73ff6711cD0b29De85', 'mainnet'),
        permit2('v3-ethereum-deployments'),
        wrappedNative(
            '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
            'Wrapped Ether',
            'v3-ethereum-deployments',
        ),
        aavePool(
            '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
            'AaveV3Ethereum',
        ),
    ],
    8453: [
        routerListed('0xeC8B0F7Ffe3ae75d7FfAb09429e3675bb63503e4', 'base'),
        routerListed('0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD', 'base'),
        routerListed('0x6fF5693b99212Da76ad316178A184AB56D299b43', 'base'),
        routerListed('0xFdf682F51FE81Aa4898F0AE2163d8A55c127fbC7', 'base'),
        routerListed('0xd6145b2D3F379919E8CdEda7B97e37c4b2Ca9c40', 'base'),
        permit2('v3-base-deployments'),
        wrappedNative(
            '0x4200000000000000000000000000000000000006',
            'Wrapped Ether',
            'v3-base-deployments',
        ),
        aavePool('0xA238Dd80C259a72e81d7e4664a9801593F98d1c5', 'AaveV3Base'),
    ],
    56: [
        routerListed('0x5Dc88340E1c5c6366864Ee415d6034cadd1A9897', 'bsc'),
        routerListed('0xeC8B0F7Ffe3ae75d7FfAb09429e3675bb63503e4', 'bsc'),
        routerListed('0x4Dae2f939ACf50408e13d58534Ff8c2776d45265', 'bsc'),
        routerListed('0x1906c1d672b88cD1B9aC7593301cA990F94Eae07', 'bsc'),
        routerListed('0x8B844f885672f333Bc0042cB669255f93a4C1E6b', 'bsc'),
        routerListed('0xDc264714F68d84CF29BC605589405E78bDBE7C9f', 'bsc'),
        permit2('v3-bnb-deployments'),
        wrappedNative(
            '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
            'Wrapped BNB',
            'v3-bnb-deployments',
        ),
        aavePool('0x6807dc923806fE8Fd134338EABCA509979a7e0cB', 'AaveV3BNB'),
    ],
    42_161: [
        routerListed('0x4C60051384bd2d3C01bfc845Cf5F4b44bcbE9de5', 'arbitrum'),
        routerListed('0xeC8B0F7Ffe3ae75d7FfAb09429e3675bb63503e4', 'arbitrum'),
        routerListed('0x5E325eDA8064b456f4781070C0738d849c824258', 'arbitrum'),
        routerListed('0xA51afAFe0263b40EdaEf0Df8781eA9aa03E381a3', 'arbitrum'),
        routerListed('0x8B844f885672f333Bc0042cB669255f93a4C1E6b', 'arbitrum'),
        routerListed('0x2d01411773c8C24805306E89A41F7855C3c4Fe65', 'arbitrum'),
        permit2('v3-arbitrum-deployments'),
        wrappedNative(
            '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
            'Wrapped Ether',
            'v3-arbitrum-deployments',
        ),
        aavePool(
            '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
            'AaveV3Arbitrum',
        ),
    ],
    43_114: [
        routerListed('0x82635AF6146972cD6601161c4472ffe97237D292', 'avalanche'),
        routerListed('0x4Dae2f939ACf50408e13d58534Ff8c2776d45265', 'avalanche'),
        // The V2 router: in Uniswap's Avalanche deployments page, not in `deploy-addresses`.
        router(
            '0x94b75331AE8d42C1b61065089B7d48FE14aA73b7',
            `${UNISWAP_DEPLOYMENTS}/v3-avalanche-deployments`,
        ),
        routerListed('0x8B844f885672f333Bc0042cB669255f93a4C1E6b', 'avalanche'),
        routerListed('0x661E93cca42AfacB172121EF892830cA3b70F08d', 'avalanche'),
        permit2('v3-avalanche-deployments'),
        wrappedNative(
            '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
            'Wrapped AVAX',
            'v3-avalanche-deployments',
        ),
        aavePool(
            '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
            'AaveV3Avalanche',
        ),
    ],
    137: [
        routerListed('0x4C60051384bd2d3C01bfc845Cf5F4b44bcbE9de5', 'polygon'),
        routerListed('0x643770E279d5D0733F21d6DC03A8efbABf3255B4', 'polygon'),
        routerListed('0xec7BE89e9d109e7e3Fec59c222CF297125FEFda2', 'polygon'),
        routerListed('0x1095692A6237d83C6a72F3F5eFEdb9A670C49223', 'polygon'),
        routerListed('0x8B844f885672f333Bc0042cB669255f93a4C1E6b', 'polygon'),
        routerListed('0xDc264714F68d84CF29BC605589405E78bDBE7C9f', 'polygon'),
        permit2('v3-polygon-deployments'),
        wrappedNative(
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            'Wrapped POL',
            'v3-polygon-deployments',
        ),
        aavePool('0x794a61358D6845594F94dc1DB02A252b5b4814aD', 'AaveV3Polygon'),
    ],
}

/** Undefined on a chain with no entries, such as a testnet or a custom network. */
export const findKnownEvmContract = (
    eip155ChainId: number,
    address: Address,
): Optional<KnownEvmContract> =>
    KNOWN_EVM_CONTRACTS[eip155ChainId]?.find(contract =>
        areEvmAddressesEqual(contract.address, address),
    )

/** A spend approval's `knownSpender`, when `spender` is in the registry. */
export const knownSpenderOf = (
    eip155ChainId: Optional<number>,
    spender: string,
): Optional<KnownSpender> => {
    const known =
        eip155ChainId === undefined || !isAddress(spender)
            ? undefined
            : findKnownEvmContract(eip155ChainId, spender)
    return (
        known && {
            name: known.name,
            ...(known.projectDomain && { projectDomain: known.projectDomain }),
        }
    )
}

export const wrappedNativeOf = (eip155ChainId: number): Optional<Address> =>
    KNOWN_EVM_CONTRACTS[eip155ChainId]?.find(
        contract => contract.kind === 'wrapped-native',
    )?.address
