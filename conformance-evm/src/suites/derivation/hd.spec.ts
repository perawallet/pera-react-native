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

import { generateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { describe, expect, it } from 'vitest'
import { ethereumHdPath } from '@perawallet/wallet-core-chain-ethereum/accounts/hd-derivation'

import {
    createHdEvmAccount,
    fundEvmAccount,
    nativeBalanceOf,
} from '../../harness/accounts'
import { castAddressFromMnemonic } from '../../harness/cast'
import {
    createEvmConformanceEnv,
    createEvmConformanceSession,
    envFor,
} from '../../harness/context'
import { EVMNET_CHAINS } from '../../harness/evmnet'
import { ANVIL_DEV_MNEMONIC_VECTOR } from '../../vectors/knownAnswerVectors'

/**
 * Proves the app's BIP-39 → BIP-32 secp256k1 derivation lands on the address
 * cast derives from the same mnemonic and path, and that the node credits that
 * address. A mock keystore would agree with itself; cast and the node don't.
 */
describe('evm hd derivation conformance', () => {
    it.each([0, 1])(
        'reproduces the published Anvil dev vector at index %i',
        async index => {
            const env = await createEvmConformanceEnv('ethereum')

            const account = await createHdEvmAccount(env, {
                mnemonic: ANVIL_DEV_MNEMONIC_VECTOR.mnemonic,
                index,
            })

            // Oracle parity: the published vector.
            expect(account.address).toBe(
                ANVIL_DEV_MNEMONIC_VECTOR.addresses[index],
            )
        },
    )

    it('matches cast for a fresh mnemonic across accounts and indices', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const mnemonic = generateMnemonic(wordlist, 256)

        for (const account of [0, 1]) {
            for (const index of [0, 1, 7]) {
                const derived = await createHdEvmAccount(env, {
                    mnemonic,
                    account,
                    index,
                })

                // Oracle parity: cast over the same mnemonic and path.
                expect(derived.address).toBe(
                    await castAddressFromMnemonic({ mnemonic, account, index }),
                )
                expect(derived.hdPath).toBe(`m/44'/60'/${account}'/0/${index}`)
            }
        }
    })

    it.each([
        [0, 0],
        [0, 7],
        [3, 12],
    ])('builds the BIP-44 path for account %i index %i', (account, index) => {
        expect(ethereumHdPath(account, index)).toBe(
            `m/44'/60'/${account}'/0/${index}`,
        )
    })

    it('derives the same address on all six chains', async () => {
        const session = await createEvmConformanceSession()
        const mnemonic = generateMnemonic(wordlist, 256)
        const expected = await castAddressFromMnemonic({ mnemonic })

        const addresses: string[] = []
        for (const chain of EVMNET_CHAINS) {
            const account = await createHdEvmAccount(envFor(session, chain), {
                mnemonic,
            })
            addresses.push(account.address)
        }

        expect(addresses).toHaveLength(6)
        expect(addresses).toEqual(addresses.map(() => expected))
    })

    it('derives an address the node credits, read through the app', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const mnemonic = generateMnemonic(wordlist, 256)
        const account = await createHdEvmAccount(env, { mnemonic })
        const funded = 123_456_789_012_345_678n

        // Node acceptance: fund what cast derives, read what the app derives.
        await fundEvmAccount(
            env,
            await castAddressFromMnemonic({ mnemonic }),
            funded,
        )

        expect(await nativeBalanceOf(env, account.address)).toBe(funded)
    })
})
