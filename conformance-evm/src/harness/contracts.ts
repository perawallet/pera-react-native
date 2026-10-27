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
import {
    ANVIL_DEV_PRIVATE_KEY,
    castAddressFromPrivateKey,
    castSend,
} from './cast'
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
    const { contractAddress } = await castSend({
        chain,
        privateKey: ANVIL_DEV_PRIVATE_KEY,
        create: `${bytecode}${encodedArgs.slice(2)}`,
    })
    if (!contractAddress) {
        throw new Error(`deploying ${name} on ${chain} created no contract`)
    }
    return contractAddress
}

export const installMulticall3 = async (chain: EvmnetChain): Promise<void> => {
    await anvilRpc(chain, 'anvil_setCode', [
        MULTICALL3_ADDRESS,
        MULTICALL3_RUNTIME_BYTECODE,
    ])
}

const DEV_FUNDER_FLOOR = 1000n * 10n ** 18n

/** A long-lived evmnet drains the dev key across runs; refilling it keeps a spent funder from surfacing as an obscure insufficient-funds error. */
export const topUpDevFunder = async (chain: EvmnetChain): Promise<void> => {
    const funder = await castAddressFromPrivateKey(ANVIL_DEV_PRIVATE_KEY)
    const balance = BigInt(
        await anvilRpc<Hex>(chain, 'eth_getBalance', [funder, 'latest']),
    )
    if (balance < DEV_FUNDER_FLOOR) {
        await anvilRpc(chain, 'anvil_setBalance', [
            funder,
            `0x${(1_000_000n * 10n ** 18n).toString(16)}`,
        ])
    }
}
