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

import { createRawKeyEvmAccount, fundEvmAccount } from '../../harness/accounts'
import {
    ANVIL_DEV_PRIVATE_KEY,
    castCall,
    castCalldata,
    castSend,
} from '../../harness/cast'
import { deployContract, type ContractName } from '../../harness/contracts'
import { createEvmConformanceEnv } from '../../harness/context'
import { EVMNET } from '../../harness/evmnet'
import { buildTransfer, expectEvmConformant, signAndSend } from './support'

const balanceOf = async (
    chain: 'ethereum',
    token: `0x${string}`,
    holder: string,
): Promise<bigint> =>
    BigInt(
        (
            await castCall({
                chain,
                to: token as `0x${string}`,
                sig: 'balanceOf(address)(uint256)',
                args: [holder],
            })
        ).split(' ')[0],
    )

/**
 * Proves the transfer builder's ERC-20 transactions call the token with the
 * calldata cast encodes for `transfer(address,uint256)`, carry no ether, and
 * move the recipient's `balanceOf` by exactly the amount, for an 18-decimal
 * and a 6-decimal token. A mocked client can't show the token accepts the call.
 */
describe('evm erc20 transfer construction', () => {
    const transferOn = async (name: ContractName, amount: bigint) => {
        const env = await createEvmConformanceEnv('ethereum')
        const sender = await createRawKeyEvmAccount(env)
        const recipient = await createRawKeyEvmAccount(env)
        await fundEvmAccount(env, sender.address, 10n ** 18n)
        const token = await deployContract(
            env.chain,
            name,
            ['Conformance Token', 'CFT', (10n ** 30n).toString()],
            'constructor(string,string,uint256)',
        )
        await castSend({
            chain: env.chain,
            privateKey: ANVIL_DEV_PRIVATE_KEY,
            to: token,
            sig: 'transfer(address,uint256)',
            args: [sender.address, (amount * 2n).toString()],
        })
        const { unsigned, fees } = await buildTransfer(env, {
            from: sender.address,
            to: recipient.address,
            assetRef: { chainId: env.chain, assetId: token },
            amount,
        })
        const { raw, hash } = await signAndSend(env, sender, unsigned)

        // Oracle parity: the calldata is cast's encoding, sent to the token with no ether.
        await expectEvmConformant({
            env,
            intent: {
                chainId: EVMNET.ethereum.eip155ChainId,
                from: sender.address,
                nonce: 0,
                to: token,
                data: await castCalldata('transfer(address,uint256)', [
                    recipient.address,
                    amount.toString(),
                ]),
                ...fees,
            },
            raw,
            hash,
        })
        return { env, sender, recipient, token }
    }

    it('transfers an 18-decimal token amount above 2^53 exactly', async () => {
        const amount = 2n ** 60n + 7n
        const { recipient, sender, token } = await transferOn(
            'TestToken',
            amount,
        )
        expect(await balanceOf('ethereum', token, recipient.address)).toBe(
            amount,
        )
        expect(await balanceOf('ethereum', token, sender.address)).toBe(amount)
    })

    it('transfers a 6-decimal token amount', async () => {
        const amount = 1_234_567n
        const { recipient, token } = await transferOn('SixDecimalToken', amount)
        expect(await balanceOf('ethereum', token, recipient.address)).toBe(
            amount,
        )
    })
})
