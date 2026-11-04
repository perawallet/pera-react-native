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

import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'
import type { Address } from 'viem'
import { EVM_CHAIN_NETWORKS } from '@perawallet/wallet-core-chain-contract'
import {
    KNOWN_EVM_CONTRACTS,
    findKnownEvmContract,
    knownSpenderOf,
    wrappedNativeOf,
} from '../known-contracts'

const PERMIT2: Address = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
const MAINNET_WETH: Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const BASE_WETH: Address = '0x4200000000000000000000000000000000000006'
// The router the Uniswap app sent a swap to in QA.
const ROUTER_2_1_2: Address = '0x23617e59A5925b2A4Bf75d73ff6711cD0b29De85'

const MAINNET_IDS = Object.values(EVM_CHAIN_NETWORKS).flatMap(row =>
    row.networks
        .filter(network => network.tier === 'mainnet')
        .map(network => network.eip155ChainId),
)

describe('KNOWN_EVM_CONTRACTS', () => {
    it('covers every mainnet chain with its routers, Permit2, wrapped native token and Aave V3 pool', () => {
        expect(Object.keys(KNOWN_EVM_CONTRACTS).map(Number).sort()).toEqual(
            [...MAINNET_IDS].sort(),
        )
        for (const chainId of MAINNET_IDS) {
            const kinds = new Set(
                KNOWN_EVM_CONTRACTS[chainId].map(contract => contract.kind),
            )

            expect(kinds).toEqual(
                new Set([
                    'uniswap-universal-router',
                    'uniswap-permit2',
                    'wrapped-native',
                    'aave-v3-pool',
                ]),
            )
        }
    })

    it.each(MAINNET_IDS)(
        'lists only checksummed, unique addresses with a source on chain %i',
        chainId => {
            const entries = KNOWN_EVM_CONTRACTS[chainId]

            for (const entry of entries) {
                expect(getAddress(entry.address)).toBe(entry.address)
                expect(entry.source).toMatch(/^https:\/\//)
                expect(entry.name).not.toBe('')
            }
            const addresses = entries.map(entry => entry.address.toLowerCase())
            expect(new Set(addresses).size).toBe(addresses.length)
        },
    )

    it('names the project domain on every contract but the wrapped native token', () => {
        for (const entries of Object.values(KNOWN_EVM_CONTRACTS)) {
            for (const entry of entries) {
                expect(entry.projectDomain === undefined).toBe(
                    entry.kind === 'wrapped-native',
                )
            }
        }
    })
})

describe('findKnownEvmContract', () => {
    it.each(MAINNET_IDS)(
        'finds Permit2 and the wrapped native token on chain %i',
        chainId => {
            expect(findKnownEvmContract(chainId, PERMIT2)?.kind).toBe(
                'uniswap-permit2',
            )
            const wrapped = wrappedNativeOf(chainId)

            expect(wrapped).toBeDefined()
            expect(
                findKnownEvmContract(chainId, wrapped as Address)?.kind,
            ).toBe('wrapped-native')
        },
    )

    it('finds the router from the QA swap on Ethereum', () => {
        expect(findKnownEvmContract(1, ROUTER_2_1_2)).toMatchObject({
            kind: 'uniswap-universal-router',
            name: 'Uniswap Universal Router',
            projectDomain: 'uniswap.org',
        })
    })

    it('matches whatever the address case', () => {
        const lower = ROUTER_2_1_2.toLowerCase() as Address

        expect(findKnownEvmContract(1, lower)?.address).toBe(ROUTER_2_1_2)
    })

    it('gives nothing on a chain with no entries', () => {
        expect(findKnownEvmContract(11155111, PERMIT2)).toBeUndefined()
        expect(findKnownEvmContract(31337, PERMIT2)).toBeUndefined()
    })

    it('gives nothing for an address listed only on another chain', () => {
        expect(findKnownEvmContract(8453, BASE_WETH)?.kind).toBe(
            'wrapped-native',
        )
        expect(findKnownEvmContract(1, BASE_WETH)).toBeUndefined()
        expect(findKnownEvmContract(8453, MAINNET_WETH)).toBeUndefined()
    })

    it('gives nothing for an unlisted address', () => {
        expect(
            findKnownEvmContract(
                1,
                '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            ),
        ).toBeUndefined()
    })
})

describe('wrappedNativeOf', () => {
    it.each([
        [1, MAINNET_WETH],
        [8453, BASE_WETH],
        [56, '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'],
        [42161, '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'],
        [43114, '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7'],
        [137, '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'],
    ])('is the wrapped native token of chain %i', (chainId, address) => {
        expect(wrappedNativeOf(chainId)).toBe(address)
    })

    it('is undefined on an unknown chain', () => {
        expect(wrappedNativeOf(11155111)).toBeUndefined()
    })
})

describe('knownSpenderOf', () => {
    it('labels a registry spender with its name and project domain', () => {
        expect(knownSpenderOf(1, PERMIT2)).toEqual({
            name: 'Permit2',
            projectDomain: 'uniswap.org',
        })
    })

    it('leaves wrapped native without a project domain', () => {
        expect(knownSpenderOf(1, MAINNET_WETH)).toEqual({
            name: 'Wrapped Ether',
        })
    })

    it('is undefined with no chain, an unlisted chain, an unknown spender or a non-address', () => {
        expect(knownSpenderOf(undefined, PERMIT2)).toBeUndefined()
        expect(knownSpenderOf(11_155_111, PERMIT2)).toBeUndefined()
        expect(
            knownSpenderOf(1, '0x1111111111111111111111111111111111111111'),
        ).toBeUndefined()
        expect(knownSpenderOf(1, 'not-an-address')).toBeUndefined()
    })
})
