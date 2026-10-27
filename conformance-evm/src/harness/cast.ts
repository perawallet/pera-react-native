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

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import type { Address, Hex } from 'viem'

import { EVMNET, type EvmnetChain } from './evmnet'

const run = promisify(execFile)

// Every Anvil container serves its node here regardless of the published host port.
const CONTAINER_RPC_URL = 'http://127.0.0.1:8545'

// Anvil's dev account 0.
export const ANVIL_DEV_PRIVATE_KEY: Hex =
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

// Oracle-only commands never touch a node, so any container will do.
const ORACLE_CONTAINER = EVMNET.ethereum.container

// execFile errors embed argv, so only Anvil dev keys and throwaway test keys may ever be passed.
const docker = async (container: string, args: string[]): Promise<string> => {
    const { stdout } = await run(
        'docker',
        ['exec', container, 'cast', ...args],
        {
            maxBuffer: 64 * 1024 * 1024,
        },
    )
    return stdout.trim()
}

const oracle = (args: string[]): Promise<string> =>
    docker(ORACLE_CONTAINER, args)

export const isCastAvailable = async (): Promise<boolean> => {
    try {
        await oracle(['--version'])
        return true
    } catch {
        return false
    }
}

type MnemonicInput = { mnemonic: string; account?: number; index?: number }

const derivationArgs = ({
    mnemonic,
    account = 0,
    index = 0,
}: MnemonicInput): string[] => [
    '--mnemonic',
    mnemonic,
    '--mnemonic-derivation-path',
    `m/44'/60'/${account}'/0/${index}`,
]

export const castAddressFromMnemonic = async (
    input: MnemonicInput,
): Promise<Address> =>
    (await oracle(['wallet', 'address', ...derivationArgs(input)])) as Address

export const castPrivateKeyFromMnemonic = async (
    input: MnemonicInput,
): Promise<Hex> =>
    (await oracle(['wallet', 'private-key', ...derivationArgs(input)])) as Hex

export const castAddressFromPrivateKey = async (
    privateKey: Hex,
): Promise<Address> =>
    (await oracle([
        'wallet',
        'address',
        '--private-key',
        privateKey,
    ])) as Address

type MktxInput = {
    privateKey: Hex
    nonce: number
    to: Address
    value: bigint
    data?: Hex
    gas: bigint
    /** Max fee per gas for EIP-1559, the gas price for legacy. */
    maxFeePerGas: bigint
    maxPriorityFeePerGas?: bigint
    legacy?: boolean
} & ({ chain: EvmnetChain } | { chainId: number })

/**
 * Every field is passed explicitly so cast never asks a node for a nonce, fee
 * or chain id; the build is fully offline.
 */
export const castMktx = async (input: MktxInput): Promise<Hex> => {
    const chainId =
        'chain' in input ? EVMNET[input.chain].eip155ChainId : input.chainId
    const args = [
        'mktx',
        '--private-key',
        input.privateKey,
        '--chain',
        String(chainId),
        '--nonce',
        String(input.nonce),
        '--gas-limit',
        input.gas.toString(),
        '--gas-price',
        input.maxFeePerGas.toString(),
        '--value',
        input.value.toString(),
    ]
    if (input.legacy) {
        args.push('--legacy')
    } else {
        if (input.maxPriorityFeePerGas === undefined) {
            throw new Error('maxPriorityFeePerGas is required unless legacy')
        }
        args.push('--priority-gas-price', input.maxPriorityFeePerGas.toString())
    }
    // A 0x-prefixed SIG is treated by cast as raw calldata.
    args.push('--', input.to)
    if (input.data !== undefined && input.data !== '0x') {
        args.push(input.data)
    }
    return (await oracle(args)) as Hex
}

/** A 0x-prefixed message is decoded to bytes before signing; anything else is signed as UTF-8 text. */
export const castSignMessage = async (input: {
    privateKey: Hex
    message: string | Hex
}): Promise<Hex> =>
    (await oracle([
        'wallet',
        'sign',
        '--private-key',
        input.privateKey,
        '--',
        input.message,
    ])) as Hex

export const castVerifyMessage = async (input: {
    address: Address
    message: string | Hex
    signature: Hex
}): Promise<boolean> => {
    try {
        await oracle([
            'wallet',
            'verify',
            '--address',
            input.address,
            '--',
            input.message,
            input.signature,
        ])
        return true
    } catch (error) {
        const stderr = (error as { stderr?: unknown }).stderr
        if (
            typeof stderr === 'string' &&
            stderr.includes('did not sign this message')
        ) {
            return false
        }
        throw error
    }
}

export const castSignTypedData = async (input: {
    privateKey: Hex
    typedData: unknown
}): Promise<Hex> =>
    (await oracle([
        'wallet',
        'sign',
        '--private-key',
        input.privateKey,
        '--data',
        JSON.stringify(input.typedData),
    ])) as Hex

export const castDecodeTransaction = async (
    raw: Hex,
): Promise<Record<string, unknown>> =>
    JSON.parse(await oracle(['decode-transaction', '--json', raw])) as Record<
        string,
        unknown
    >

type Receipt = {
    status: Hex
    transactionHash: Hex
    contractAddress: Address | null
}

export const castSend = async (input: {
    chain: EvmnetChain
    privateKey: Hex
    to?: Address
    create?: Hex
    value?: bigint
    /** Passing this bypasses cast's gas estimation, so a reverting call is mined and fails on its receipt. */
    gasLimit?: bigint
    sig?: string
    args?: readonly string[]
}): Promise<{ hash: Hex; contractAddress?: Address }> => {
    const args = [
        'send',
        '--rpc-url',
        CONTAINER_RPC_URL,
        '--private-key',
        input.privateKey,
        '--json',
    ]
    if (input.value !== undefined) {
        args.push('--value', input.value.toString())
    }
    if (input.gasLimit !== undefined) {
        args.push('--gas-limit', input.gasLimit.toString())
    }
    if (input.create !== undefined) {
        args.push('--create', input.create)
    }
    const positionals = [
        ...(input.create === undefined && input.to !== undefined
            ? [input.to]
            : []),
        ...(input.sig !== undefined ? [input.sig, ...(input.args ?? [])] : []),
    ]
    if (positionals.length > 0) {
        args.push('--', ...positionals)
    }
    const receipt = JSON.parse(
        await docker(EVMNET[input.chain].container, args),
    ) as Receipt
    if (receipt.status !== '0x1') {
        throw new Error(
            `transaction ${receipt.transactionHash} on ${input.chain} failed with status ${receipt.status}`,
        )
    }
    return {
        hash: receipt.transactionHash,
        ...(receipt.contractAddress
            ? { contractAddress: receipt.contractAddress }
            : {}),
    }
}

/** Read-only `eth_call` through cast; rejects with cast's stderr on a revert. */
export const castCall = (input: {
    chain: EvmnetChain
    to: Address
    sig: string
    args?: readonly string[]
}): Promise<string> =>
    docker(EVMNET[input.chain].container, [
        'call',
        '--rpc-url',
        CONTAINER_RPC_URL,
        '--',
        input.to,
        input.sig,
        ...(input.args ?? []),
    ])

export const fundFromDev = async (
    chain: EvmnetChain,
    to: Address,
    wei: bigint,
): Promise<Hex> =>
    (
        await castSend({
            chain,
            privateKey: ANVIL_DEV_PRIVATE_KEY,
            to,
            value: wei,
        })
    ).hash

export const castChecksumAddress = async (address: string): Promise<Address> =>
    (await oracle(['to-check-sum-address', address])) as Address
