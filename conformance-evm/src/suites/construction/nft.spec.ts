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
import { describe, expect, it } from 'vitest'
import {
    PeraAssetType,
    PeraAssetVerificationTier,
    upsertAssets,
} from '@perawallet/wallet-core-assets'
import { toEvmNftAssetId } from '@perawallet/wallet-core-chain-ethereum/blockchain/utils/caip19'

import { createRawKeyEvmAccount, fundEvmAccount } from '../../harness/accounts'
import {
    ANVIL_DEV_PRIVATE_KEY,
    castCall,
    castCalldata,
    castSend,
} from '../../harness/cast'
import { deployContract } from '../../harness/contracts'
import {
    createEvmConformanceEnv,
    type EvmConformanceEnv,
} from '../../harness/context'
import { EVMNET } from '../../harness/evmnet'
import { buildTransfer, expectEvmConformant, signAndSend } from './support'

// The builder reads the standard from the asset store, which the NFT sync fills.
const storeNft = async (
    env: EvmConformanceEnv,
    contract: `0x${string}`,
    tokenId: bigint,
    standard: 'erc721' | 'erc1155',
) => {
    const assetId = toEvmNftAssetId(contract, tokenId.toString())
    await upsertAssets({
        scope: env.scope,
        items: [
            {
                assetId,
                name: 'Conformance NFT',
                decimals: 0,
                totalSupply: new Decimal(0),
                creator: { address: contract },
                peraMetadata: {
                    isDeleted: false,
                    verificationTier: PeraAssetVerificationTier.unverified,
                    type: PeraAssetType.collectible,
                    isUnique: standard === 'erc721',
                    collectible: { standard },
                },
            },
        ],
    })
    return assetId
}

/**
 * Proves the NFT branch of the transfer builder emits the `safeTransferFrom`
 * overload each standard defines, with calldata equal to cast's encoding, and
 * that the token contract then reports the new owner or balance. A mocked
 * client can't show the contract accepts the call.
 */
describe('evm nft transfer construction', () => {
    const setup = async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const sender = await createRawKeyEvmAccount(env)
        const recipient = await createRawKeyEvmAccount(env)
        await fundEvmAccount(env, sender.address, 10n ** 18n)
        return { env, sender, recipient }
    }

    it('transfers an ERC-721 with safeTransferFrom(address,address,uint256)', async () => {
        const { env, sender, recipient } = await setup()
        const nft = await deployContract(env.chain, 'TestNft721')
        const tokenId = 2n ** 60n + 9n
        await castSend({
            chain: env.chain,
            privateKey: ANVIL_DEV_PRIVATE_KEY,
            to: nft,
            sig: 'mint(address,uint256)',
            args: [sender.address, tokenId.toString()],
        })
        const assetId = await storeNft(env, nft, tokenId, 'erc721')

        const { unsigned, fees } = await buildTransfer(env, {
            from: sender.address,
            to: recipient.address,
            assetRef: { chainId: env.chain, assetId },
            amount: 1n,
        })
        const { raw, hash } = await signAndSend(env, sender, unsigned)

        // Oracle parity: cast's encoding of the three-argument overload.
        await expectEvmConformant({
            env,
            intent: {
                chainId: EVMNET.ethereum.eip155ChainId,
                from: sender.address,
                nonce: 0,
                to: nft,
                data: await castCalldata(
                    'safeTransferFrom(address,address,uint256)',
                    [sender.address, recipient.address, tokenId.toString()],
                ),
                ...fees,
            },
            raw,
            hash,
        })
        const owner = await castCall({
            chain: env.chain,
            to: nft,
            sig: 'ownerOf(uint256)(address)',
            args: [tokenId.toString()],
        })
        expect(owner.toLowerCase()).toBe(recipient.address.toLowerCase())
    })

    it('transfers three of an ERC-1155 with the five-argument safeTransferFrom', async () => {
        const { env, sender, recipient } = await setup()
        const multi = await deployContract(env.chain, 'TestMulti1155')
        const tokenId = 2n ** 55n + 1n
        await castSend({
            chain: env.chain,
            privateKey: ANVIL_DEV_PRIVATE_KEY,
            to: multi,
            sig: 'mint(address,uint256,uint256)',
            args: [sender.address, tokenId.toString(), '10'],
        })
        const assetId = await storeNft(env, multi, tokenId, 'erc1155')

        const { unsigned, fees } = await buildTransfer(env, {
            from: sender.address,
            to: recipient.address,
            assetRef: { chainId: env.chain, assetId },
            amount: 3n,
        })
        const { raw, hash } = await signAndSend(env, sender, unsigned)

        // Oracle parity: cast's encoding, with the empty bytes the builder passes.
        await expectEvmConformant({
            env,
            intent: {
                chainId: EVMNET.ethereum.eip155ChainId,
                from: sender.address,
                nonce: 0,
                to: multi,
                data: await castCalldata(
                    'safeTransferFrom(address,address,uint256,uint256,bytes)',
                    [
                        sender.address,
                        recipient.address,
                        tokenId.toString(),
                        '3',
                        '0x',
                    ],
                ),
                ...fees,
            },
            raw,
            hash,
        })
        const held = async (holder: string) =>
            BigInt(
                (
                    await castCall({
                        chain: env.chain,
                        to: multi,
                        sig: 'balanceOf(uint256,address)(uint256)',
                        args: [tokenId.toString(), holder],
                    })
                ).split(' ')[0],
            )
        expect(await held(recipient.address)).toBe(3n)
        expect(await held(sender.address)).toBe(7n)
    })
})
