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

import { MULTICALL3_ADDRESS } from '@perawallet/wallet-core-chain-ethereum/blockchain/utils/erc20'
import { keccak256 } from 'viem'
import { beforeAll, describe, expect, it } from 'vitest'

import {
    MULTICALL3_CODEHASH,
    MULTICALL3_RUNTIME_BYTECODE,
} from '../../vectors/multicall3'
import { deployContract, installMulticall3, loadArtifact } from '../contracts'
import { anvilRpc, assertEvmnetReachable } from '../evmnet'

describe('contract helpers', () => {
    beforeAll(async () => {
        await assertEvmnetReachable('ethereum')
    })

    it('pins the vendored Multicall3 runtime to its code hash', () => {
        expect(keccak256(MULTICALL3_RUNTIME_BYTECODE)).toBe(MULTICALL3_CODEHASH)
    })

    it('installs the vendored Multicall3 runtime, idempotently', async () => {
        await installMulticall3('ethereum')
        await installMulticall3('ethereum')

        const code = await anvilRpc<string>('ethereum', 'eth_getCode', [
            MULTICALL3_ADDRESS,
            'latest',
        ])

        expect(code).toBe(MULTICALL3_RUNTIME_BYTECODE)
    })

    it('loads an artifact with an ABI and bytecode', () => {
        const { abi, bytecode } = loadArtifact('Reverter')

        expect(abi.length).toBeGreaterThan(0)
        expect(bytecode.startsWith('0x')).toBe(true)
    })

    it('deploys a contract and returns an address with code', async () => {
        const address = await deployContract(
            'ethereum',
            'TestToken',
            ['Test', 'TST', '1000000000000000000000000'],
            'constructor(string,string,uint256)',
        )

        const code = await anvilRpc<string>('ethereum', 'eth_getCode', [
            address,
            'latest',
        ])

        expect(code.length).toBeGreaterThan(2)
    })
})
