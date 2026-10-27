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

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { MULTICALL3_ADDRESS } from '@perawallet/wallet-core-chain-ethereum/blockchain/utils/erc20'
import {
    type Abi,
    type AbiParameter,
    type Address,
    type Hex,
    encodeAbiParameters,
    parseAbiParameters,
} from 'viem'

import { MULTICALL3_RUNTIME_BYTECODE } from '../vectors/multicall3'
import { type EvmnetChain, anvilRpc } from './evmnet'

export type ContractName =
    | 'TestToken'
    | 'SixDecimalToken'
    | 'Bytes32SymbolToken'
    | 'TestNft721'
    | 'TestMulti1155'
    | 'Reverter'

type Artifact = { abi: Abi; bytecode: Hex }

const ARTIFACTS_DIR = resolve(import.meta.dirname, '../../contracts/artifacts')

// Anvil's unlocked dev account 0.
const DEPLOYER: Address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

const RECEIPT_POLL_MS = 100
const RECEIPT_TIMEOUT_MS = 30_000

export const loadArtifact = (name: ContractName): Artifact =>
    JSON.parse(
        readFileSync(resolve(ARTIFACTS_DIR, `${name}.json`), 'utf8'),
    ) as Artifact

const coerceArg = (type: string, value: string): unknown => {
    if (/^u?int\d*$/.test(type)) {
        return BigInt(value)
    }
    if (type === 'bool') {
        return value === 'true'
    }
    return value
}

const encodeConstructorArgs = (
    constructorSig: string,
    args: readonly string[],
): Hex => {
    const inner = constructorSig.replace(/^constructor\((.*)\)$/, '$1')
    const params = parseAbiParameters(inner) as readonly AbiParameter[]
    if (params.length !== args.length) {
        throw new Error(
            `${constructorSig} takes ${params.length} arguments, got ${args.length}`,
        )
    }
    return encodeAbiParameters(
        params,
        params.map((param, i) => coerceArg(param.type, args[i])),
    )
}

type Receipt = { contractAddress: Address | null; status: Hex } | null

const waitForReceipt = async (
    chain: EvmnetChain,
    hash: Hex,
): Promise<NonNullable<Receipt>> => {
    const deadline = Date.now() + RECEIPT_TIMEOUT_MS
    while (Date.now() < deadline) {
        const receipt = await anvilRpc<Receipt>(
            chain,
            'eth_getTransactionReceipt',
            [hash],
        )
        if (receipt) {
            return receipt
        }
        await new Promise(done => setTimeout(done, RECEIPT_POLL_MS))
    }
    throw new Error(`deploy ${hash} on ${chain} was not mined in time`)
}

export const deployContract = async (
    chain: EvmnetChain,
    name: ContractName,
    constructorArgs: readonly string[] = [],
    constructorSig = 'constructor()',
): Promise<Address> => {
    const { bytecode } = loadArtifact(name)
    const encodedArgs =
        constructorArgs.length > 0
            ? encodeConstructorArgs(constructorSig, constructorArgs)
            : '0x'
    const hash = await anvilRpc<Hex>(chain, 'eth_sendTransaction', [
        { from: DEPLOYER, data: `${bytecode}${encodedArgs.slice(2)}` },
    ])
    const receipt = await waitForReceipt(chain, hash)
    if (receipt.status !== '0x1' || !receipt.contractAddress) {
        throw new Error(`deploying ${name} on ${chain} failed (${hash})`)
    }
    return receipt.contractAddress
}

export const installMulticall3 = async (chain: EvmnetChain): Promise<void> => {
    await anvilRpc(chain, 'anvil_setCode', [
        MULTICALL3_ADDRESS,
        MULTICALL3_RUNTIME_BYTECODE,
    ])
}
