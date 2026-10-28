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
import type { Address, Hex } from 'viem'
import { buildAccount } from '@perawallet/wallet-core-accounts/credentials/buildAccount'
import type { WalletAccount } from '@perawallet/wallet-core-accounts/models/accounts'
import type { DeriveOpts } from '@perawallet/wallet-core-chain-contract'
import { ethereumHdPath } from '@perawallet/wallet-core-chain-ethereum/accounts/hd-derivation'
import { createEvmKeyDerivation } from '@perawallet/wallet-core-chain-ethereum/accounts/key-derivation'
import { parseEthereumPrivateKey } from '@perawallet/wallet-core-chain-ethereum/accounts/private-key'
import { createEvmClient } from '@perawallet/wallet-core-chain-ethereum/blockchain/utils/createEvmClient'
import { SeedScheme } from '@perawallet/wallet-core-kms/constants'
import { mnemonicWordsToIndices } from '@perawallet/wallet-core-kms/crypto/mnemonic-indices'
import { prepareHDMasterKey } from '@perawallet/wallet-core-kms/crypto/prepare-hd-master-key'
import {
    buildSeedMetadata,
    entropyChildMetadata,
} from '@perawallet/wallet-core-kms/utils'

import { castPrivateKeyFromMnemonic, fundFromDev } from './cast'
import type { EvmConformanceEnv } from './context'

export type EvmConformanceAccount = {
    kind: 'hd' | 'raw'
    /** EIP-55 checksummed, as the app's address codec emits it. */
    address: Address
    /** For the oracle side only; the app signs through its keystore entry. */
    privateKey: Hex
    mnemonic?: string
    hdPath?: string
    keyPairId: string
    /** The app's own account model, handed to app code that dispatches on custody. */
    walletAccount: WalletAccount
}

const deriveOptsOf = (env: EvmConformanceEnv): DeriveOpts => ({
    scheme: 'secp256k1',
    networkId: env.scope.networkId,
})

/**
 * Persists a BIP-39 wallet root the way `useHDWallet().persistHDMasterKey`
 * does: the XHD root as `hd-root-key` under bip39 seed metadata, and the
 * entropy as a separate `secret-key` child, which is what kms derives
 * secp256k1 children from.
 */
const importHdWallet = async (
    env: EvmConformanceEnv,
    mnemonic: string,
): Promise<string> => {
    const secrets = env.keyStore.secrets
    if (!secrets) throw new Error('keystore does not implement secrets')
    // Throw, don't fall through: an undefined index list mints a random wallet.
    const mnemonicIndices = mnemonicWordsToIndices(mnemonic.split(' '))
    if (!mnemonicIndices) {
        throw new Error('HD mnemonic contains non-wordlist words')
    }
    const prepared = await prepareHDMasterKey({
        id: crypto.randomUUID(),
        mnemonicIndices,
    })
    try {
        await env.keyStore.import(
            {
                id: prepared.keyId,
                type: 'hd-root-key',
                algorithm: 'raw',
                extractable: true,
                keyUsages: ['deriveKey', 'deriveBits'],
                privateKey: prepared.rootKey,
                metadata: buildSeedMetadata({ scheme: SeedScheme.Bip39 }),
            },
            'raw',
        )
        await secrets.put(Uint8Array.from(prepared.entropy), {
            id: crypto.randomUUID(),
            metadata: entropyChildMetadata(prepared.keyId),
        })
    } finally {
        prepared.rootKey.fill(0)
        prepared.entropy.fill(0)
    }
    return prepared.keyId
}

export const createHdEvmAccount = async (
    env: EvmConformanceEnv,
    opts: { mnemonic?: string; account?: number; index?: number } = {},
): Promise<EvmConformanceAccount> => {
    const {
        mnemonic = generateMnemonic(wordlist, 256),
        account = 0,
        index = 0,
    } = opts
    const seedRef = await importHdWallet(env, mnemonic)
    const { address, keyPairId } = await createEvmKeyDerivation(
        env.evmChain,
    ).deriveAccount(env.kms, seedRef, account, index, deriveOptsOf(env))
    return {
        kind: 'hd',
        address: address as Address,
        privateKey: await castPrivateKeyFromMnemonic({
            mnemonic,
            account,
            index,
        }),
        mnemonic,
        hdPath: ethereumHdPath(account, index),
        keyPairId,
        walletAccount: buildAccount({
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account, keyIndex: index },
            },
            chainId: env.chain,
            chains: { [env.chain]: { address, keyPairId } },
        }),
    }
}

const randomPrivateKey = (): Hex =>
    `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}`

export const createRawKeyEvmAccount = async (
    env: EvmConformanceEnv,
    privateKey: Hex = randomPrivateKey(),
): Promise<EvmConformanceAccount> => {
    // importRawKey zeroes the bytes it is handed.
    const bytes = parseEthereumPrivateKey(privateKey)
    const { address, keyPairId } = await createEvmKeyDerivation(
        env.evmChain,
    ).importRawKey(env.kms, bytes, deriveOptsOf(env))
    return {
        kind: 'raw',
        address: address as Address,
        privateKey,
        keyPairId,
        walletAccount: buildAccount({
            custody: { kind: 'local', seed: null },
            chainId: env.chain,
            chains: { [env.chain]: { address, keyPairId } },
        }),
    }
}

export const fundEvmAccount = async (
    env: EvmConformanceEnv,
    address: Address,
    wei: bigint,
): Promise<void> => {
    await fundFromDev(env.chain, address, wei)
}

/** In wei, read through the app's own client; `blockNumber` pins the read. */
export const nativeBalanceOf = (
    env: EvmConformanceEnv,
    address: Address,
    blockNumber?: bigint,
): Promise<bigint> =>
    createEvmClient(env.scope, env.ctx, env.evmChain).getBalance(
        blockNumber === undefined ? { address } : { address, blockNumber },
    )
