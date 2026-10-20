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

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import {
    accountsChainAdapters,
    buildAccount,
} from '@perawallet/wallet-core-accounts'
import { assetsChainAdapters } from '@perawallet/wallet-core-assets'
import {
    broadcasterChainAdapters,
    localKeySignerChainAdapters,
    messageSignerChainAdapters,
    reviewerChainAdapters,
} from '@perawallet/wallet-core-signing'
import {
    addressCodecs,
    keyDerivations,
    transactionPlanners,
    transactionReviewers,
    type ChainContext,
} from '@perawallet/wallet-core-chain-contract'
import { nodeEndpointAdapters } from '@perawallet/wallet-core-chain-shared'
import { dappRequestChainAdapters } from '@perawallet/wallet-core-connections/dappRequest'
import { deeplinkAdapters } from '@perawallet/wallet-core-deeplinks'
import {
    historyChainAdapters,
    transferChainAdapters,
} from '@perawallet/wallet-core-transactions'
import { ledgerAppDriverRegistry } from '@perawallet/wallet-extension-hardware-wallet'
import { createEvmChainRegistration } from '../register'
import { BASE, ETHEREUM, EVM_TEST_CHAINS, POLYGON } from './evm-chains'

const ADDRESS = '0x00000000000000000000000000000000000000aa'
const context = {} as ChainContext
const SRC = join(__dirname, '..')

const resetRegistries = () => {
    addressCodecs.reset()
    keyDerivations.reset()
    transactionPlanners.reset()
    transactionReviewers.reset()
    messageSignerChainAdapters.reset()
    reviewerChainAdapters.reset()
    localKeySignerChainAdapters.reset()
    accountsChainAdapters.reset()
    assetsChainAdapters.reset()
    transferChainAdapters.reset()
    historyChainAdapters.reset()
    broadcasterChainAdapters.reset()
    dappRequestChainAdapters.reset()
    nodeEndpointAdapters.reset()
    deeplinkAdapters.reset()
    ledgerAppDriverRegistry.reset()
}

const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap(name => {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) {
            return name === '__tests__' ? [] : sourceFiles(path)
        }
        return /\.tsx?$/.test(name) && name !== 'test-handlers.ts' ? [path] : []
    })

describe('createEvmChainRegistration', () => {
    beforeEach(resetRegistries)

    describe.each(EVM_TEST_CHAINS)('$row.id', chain => {
        const id = chain.row.id

        it('registers every adapter under its own chain id', () => {
            createEvmChainRegistration(chain)(context)

            expect(addressCodecs.get(id).chainId).toBe(id)
            expect(keyDerivations.get(id).chainId).toBe(id)
            expect(transactionPlanners.get(id).chainId).toBe(id)
            expect(transactionReviewers.get(id).chainId).toBe(id)
            expect(messageSignerChainAdapters.get(id).chainId).toBe(id)
            expect(reviewerChainAdapters.get(id).chainId).toBe(id)
            expect(localKeySignerChainAdapters.get(id).chainId).toBe(id)
            expect(accountsChainAdapters.get(id).chainId).toBe(id)
            expect(assetsChainAdapters.get(id).getNativeAsset()).toBe(
                chain.nativeAsset,
            )
            expect(transferChainAdapters.get(id).chainId).toBe(id)
            expect(broadcasterChainAdapters.get(id).chainId).toBe(id)
            expect(historyChainAdapters.get(id).chainId).toBe(id)
            expect(dappRequestChainAdapters.get(id).chainId).toBe(id)
            expect(nodeEndpointAdapters.get(id).chainId).toBe(id)
            expect(ledgerAppDriverRegistry.resolve(id).chainId).toBe(id)
        })

        it('can run more than once, so a repeated bootstrap is harmless', () => {
            const register = createEvmChainRegistration(chain)
            register(context)

            expect(() => register({ ...context })).not.toThrow()
        })

        it.each([
            [
                'an HD entry',
                {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 1, keyIndex: 2 },
                } as const,
                'seed-1-eth-acc1-idx2',
            ],
            [
                'a private-key account',
                { kind: 'local', seed: null } as const,
                'k',
            ],
            ['a watch account', { kind: 'watch' } as const, undefined],
        ])('lets buildAccount build %s', (_, custody, keyPairId) => {
            createEvmChainRegistration(chain)(context)

            const account = buildAccount({
                custody,
                chainId: id,
                chains: { [id]: { address: ADDRESS, keyPairId } },
            })

            expect(account.chains[id]?.address).toBe(ADDRESS)
            expect(account.custody).toEqual(custody)
        })
    })

    it('registers one deeplink adapter for every EVM chain, owned by the first one registered', () => {
        for (const chain of [ETHEREUM, BASE, POLYGON]) {
            createEvmChainRegistration(chain)(context)
        }

        const owners = deeplinkAdapters
            .list()
            .filter(adapter => adapter.schemes.includes('ethereum'))
            .map(adapter => adapter.chainId)
        expect(owners).toEqual(['ethereum'])
    })

    it('lets a build without Ethereum serve ethereum: links from another EVM chain', () => {
        createEvmChainRegistration(BASE)(context)
        createEvmChainRegistration(POLYGON)(context)

        expect(deeplinkAdapters.list().map(adapter => adapter.chainId)).toEqual(
            ['base'],
        )
    })
})

describe('chain-ethereum sources', () => {
    it('keep no module-level mutable state in register.ts', () => {
        const source = readFileSync(join(SRC, 'register.ts'), 'utf8')

        expect(source).not.toMatch(/^(let|var) /m)
    })

    it('name the Ethereum chain only in the chain table', () => {
        const pinned = sourceFiles(SRC)
            .filter(path =>
                /ETHEREUM_CHAIN_ID|ethereumDescriptor/.test(
                    readFileSync(path, 'utf8'),
                ),
            )
            .map(path => relative(SRC, path))

        expect(pinned.sort()).toEqual(['chains/table.ts', 'index.ts'])
    })
})
