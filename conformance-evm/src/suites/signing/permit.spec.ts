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

import { Decimal } from 'decimal.js'
import { getAddress, hexToBigInt } from 'viem'
import type { Address, Hex, TypedDataDefinition } from 'viem'
import { describe, expect, it } from 'vitest'
import {
    isPermitTypedData,
    spendApprovalOf,
} from '@perawallet/wallet-core-chain-ethereum/signing/permits'
import { typedDataMessageRequest } from '@perawallet/wallet-core-chain-ethereum/signing/messages'

import { createRawKeyEvmAccount } from '../../harness/accounts'
import {
    ANVIL_DEV_PRIVATE_KEY,
    castCall,
    castSend,
    castSignTypedData,
} from '../../harness/cast'
import { deployContract } from '../../harness/contracts'
import { createEvmConformanceEnv } from '../../harness/context'
import { EVMNET } from '../../harness/evmnet'
import { signMessageWithApp } from '../../harness/sign'
import { rejectionOf } from '../../harness/submit'
import { ANVIL_DEV_MNEMONIC_VECTOR } from '../../vectors/knownAnswerVectors'

const SPENDER = ANVIL_DEV_MNEMONIC_VECTOR.addresses[1]
const TOKEN_NAME = 'Permit Conformance Token'
// Above 2^53.
const VALUE = 9_007_199_254_740_993n * 1_000_003n
const HOUR_SECONDS = 3600n

const permitTypedData = (input: {
    chainId: number
    token: Address
    owner: Address
    nonce: bigint
    deadline: bigint
}) =>
    ({
        types: {
            EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
                { name: 'verifyingContract', type: 'address' },
            ],
            Permit: [
                { name: 'owner', type: 'address' },
                { name: 'spender', type: 'address' },
                { name: 'value', type: 'uint256' },
                { name: 'nonce', type: 'uint256' },
                { name: 'deadline', type: 'uint256' },
            ],
        },
        primaryType: 'Permit',
        domain: {
            name: TOKEN_NAME,
            version: '1',
            chainId: input.chainId,
            verifyingContract: input.token,
        },
        message: {
            owner: input.owner,
            spender: SPENDER,
            value: VALUE.toString(),
            nonce: input.nonce.toString(),
            deadline: input.deadline.toString(),
        },
    }) as const

const splitSignature = (signature: Hex) => ({
    r: `0x${signature.slice(2, 66)}`,
    s: `0x${signature.slice(66, 130)}`,
    v: hexToBigInt(`0x${signature.slice(130, 132)}`).toString(),
})

const permitArgs = (
    owner: Address,
    deadline: bigint,
    signature: Hex,
): string[] => {
    const { r, s, v } = splitSignature(signature)
    return [owner, SPENDER, VALUE.toString(), deadline.toString(), v, r, s]
}

const PERMIT_SIG =
    'permit(address,address,uint256,uint256,uint8,bytes32,bytes32)'

// cast prints a uint with a scientific-notation hint after it.
const uintOf = (output: string): bigint => BigInt(output.split(' ')[0])

/**
 * Proves an EIP-2612 permit the app signs is accepted by the token contract
 * (so the digest, domain and recovery are the real ones), that the app's
 * review reads the same spender, token and amount the contract grants, and
 * that a permit bound to another chain neither gets signed by the app nor
 * works on the node.
 */
describe('evm permit signing conformance', () => {
    it('signs a permit the token contract accepts and the review reports it exactly', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const owner = await createRawKeyEvmAccount(env)
        const token = await deployContract(
            env.chain,
            'TestToken',
            [TOKEN_NAME, 'PCT', (10n ** 30n).toString()],
            'constructor(string,string,uint256)',
        )
        const deadline = BigInt(Math.floor(Date.now() / 1000)) + HOUR_SECONDS
        const typedData = permitTypedData({
            chainId: EVMNET.ethereum.eip155ChainId,
            token,
            owner: owner.address,
            nonce: 0n,
            deadline,
        })

        const signature = await signMessageWithApp(
            env,
            owner,
            typedDataMessageRequest(env.scope, owner.address, typedData),
        )

        // Oracle parity
        expect(signature).toEqual(
            await castSignTypedData({
                privateKey: owner.privateKey,
                typedData,
            }),
        )
        // Node acceptance: the contract's ecrecover accepts the app's v, r, s.
        await castSend({
            chain: env.chain,
            privateKey: ANVIL_DEV_PRIVATE_KEY,
            to: token,
            sig: PERMIT_SIG,
            args: permitArgs(owner.address, deadline, signature),
        })
        expect(
            uintOf(
                await castCall({
                    chain: env.chain,
                    to: token,
                    sig: 'allowance(address,address)(uint256)',
                    args: [owner.address, SPENDER],
                }),
            ),
        ).toBe(VALUE)
        expect(
            uintOf(
                await castCall({
                    chain: env.chain,
                    to: token,
                    sig: 'nonces(address)(uint256)',
                    args: [owner.address],
                }),
            ),
        ).toBe(1n)

        // Round-trip: the review reports what the contract granted.
        expect(isPermitTypedData(typedData)).toBe(true)
        const now = Date.now()
        const approval = spendApprovalOf(
            typedData as unknown as TypedDataDefinition,
            now,
            env.evmChain,
        )
        expect(approval).toEqual({
            spender: getAddress(SPENDER),
            allowances: [
                {
                    amount: new Decimal(VALUE.toString()),
                    assetRef: {
                        chainId: env.chain,
                        assetId: getAddress(token),
                    },
                },
            ],
            deadline: Number(deadline) * 1000,
            isLongLived: false,
        })
    })

    it('does not sign a permit for another chain, and the token rejects one signed elsewhere', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const owner = await createRawKeyEvmAccount(env)
        const token = await deployContract(
            env.chain,
            'TestToken',
            [TOKEN_NAME, 'PCT', (10n ** 30n).toString()],
            'constructor(string,string,uint256)',
        )
        const deadline = BigInt(Math.floor(Date.now() / 1000)) + HOUR_SECONDS
        const foreign = permitTypedData({
            chainId: EVMNET.base.eip155ChainId,
            token,
            owner: owner.address,
            nonce: 0n,
            deadline,
        })

        const refusal = await rejectionOf(() =>
            signMessageWithApp(
                env,
                owner,
                typedDataMessageRequest(env.scope, owner.address, foreign),
            ),
        )
        expect((refusal as Error).message).toBe(
            `The typed data is for EIP-155 chain ${EVMNET.base.eip155ChainId}, not ${env.scope.networkId}`,
        )

        // Node acceptance: the same permit, signed by the oracle, would not have worked here.
        const oracleSignature = await castSignTypedData({
            privateKey: owner.privateKey,
            typedData: foreign,
        })
        const reverted = await rejectionOf(() =>
            castSend({
                chain: env.chain,
                privateKey: ANVIL_DEV_PRIVATE_KEY,
                to: token,
                sig: PERMIT_SIG,
                args: permitArgs(owner.address, deadline, oracleSignature),
                gasLimit: 200_000n,
            }),
        )
        expect((reverted as Error).message).toMatch(/failed with status 0x0/)
        expect(
            uintOf(
                await castCall({
                    chain: env.chain,
                    to: token,
                    sig: 'allowance(address,address)(uint256)',
                    args: [owner.address, SPENDER],
                }),
            ),
        ).toBe(0n)

        // Control: only the chain differs, so the same permit on this chain is accepted.
        const local = permitTypedData({
            chainId: EVMNET.ethereum.eip155ChainId,
            token,
            owner: owner.address,
            nonce: 0n,
            deadline,
        })
        await castSend({
            chain: env.chain,
            privateKey: ANVIL_DEV_PRIVATE_KEY,
            to: token,
            sig: PERMIT_SIG,
            args: permitArgs(
                owner.address,
                deadline,
                await signMessageWithApp(
                    env,
                    owner,
                    typedDataMessageRequest(env.scope, owner.address, local),
                ),
            ),
        })
    })
})
