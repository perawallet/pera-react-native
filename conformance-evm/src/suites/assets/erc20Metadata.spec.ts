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

import { stringToHex } from 'viem'
import { describe, expect, it } from 'vitest'
import { readErc20 } from '@perawallet/wallet-core-chain-ethereum/blockchain/utils/erc20'

import { deployContract } from '../../harness/contracts'
import { createEvmConformanceEnv } from '../../harness/context'

/**
 * Proves the token metadata read decodes what real token contracts return:
 * 18- and 6-decimal tokens, a total supply of 2^80 exact in a Decimal, and a
 * token whose name and symbol are bytes32 (MKR, SAI), which a string-ABI
 * decoder can't read. A mocked client returns whatever the test wrote.
 */
describe('evm erc20 metadata', () => {
    it('reads an 18-decimal token with a supply above 2^53 exactly', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const supply = 2n ** 80n
        const token = await deployContract(
            env.chain,
            'TestToken',
            ['Conformance Token', 'CFT', supply.toString()],
            'constructor(string,string,uint256)',
        )

        const asset = await readErc20(env.ctx, env.evmChain, token, env.scope)

        expect(asset.name).toBe('Conformance Token')
        expect(asset.unitName).toBe('CFT')
        expect(asset.decimals).toBe(18)
        expect(asset.totalSupply.toFixed()).toBe(supply.toString())
        expect(asset.assetId.toLowerCase()).toBe(token.toLowerCase())
    })

    it('reads a 6-decimal token', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const token = await deployContract(
            env.chain,
            'SixDecimalToken',
            ['Six Token', 'SIX', '1000000'],
            'constructor(string,string,uint256)',
        )

        const asset = await readErc20(env.ctx, env.evmChain, token, env.scope)

        expect(asset.name).toBe('Six Token')
        expect(asset.unitName).toBe('SIX')
        expect(asset.decimals).toBe(6)
        expect(asset.totalSupply.toFixed()).toBe('1000000')
    })

    it('reads a token whose name and symbol are bytes32', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const token = await deployContract(
            env.chain,
            'Bytes32SymbolToken',
            [
                stringToHex('Maker', { size: 32 }),
                stringToHex('MKR', { size: 32 }),
                '1000',
            ],
            'constructor(bytes32,bytes32,uint256)',
        )

        const asset = await readErc20(env.ctx, env.evmChain, token, env.scope)

        expect(asset).toMatchObject({ name: 'Maker', unitName: 'MKR' })
    })
})
