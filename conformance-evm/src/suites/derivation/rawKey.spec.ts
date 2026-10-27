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
import type { EthereumTransactionPayload } from '@perawallet/wallet-core-chain-ethereum/signing/adapter'
import {
    formatEthereumPrivateKey,
    InvalidPrivateKeyError,
    parseEthereumPrivateKey,
} from '@perawallet/wallet-core-chain-ethereum/accounts/private-key'
import { createEvmTransferAdapter } from '@perawallet/wallet-core-chain-ethereum/transfer/builder'

import {
    createRawKeyEvmAccount,
    fundEvmAccount,
    nativeBalanceOf,
} from '../../harness/accounts'
import { expectEvmConformant } from '../../harness/assert/roundTrip'
import { castAddressFromPrivateKey } from '../../harness/cast'
import { createEvmConformanceEnv } from '../../harness/context'
import { EVMNET } from '../../harness/evmnet'
import { signTransactionWithApp } from '../../harness/sign'
import { broadcastAndConfirm } from '../../harness/submit'
import { ANVIL_DEV_MNEMONIC_VECTOR } from '../../vectors/knownAnswerVectors'

const ORDER_HEX =
    'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'
const ORDER = BigInt(`0x${ORDER_HEX}`)
const hex32 = (value: bigint): string => value.toString(16).padStart(64, '0')

/**
 * Proves the raw private-key import path enforces the secp256k1 range, keeps
 * the key's bytes intact, lands on the address cast derives from the same key,
 * and yields a key whose app-signed transfer the node accepts.
 */
describe('evm raw-key import conformance', () => {
    describe('parseEthereumPrivateKey', () => {
        it.each([
            ['zero', hex32(0n)],
            ['the curve order n', ORDER_HEX],
            ['n + 1', hex32(ORDER + 1n)],
            ['the maximum 256-bit value', 'ff'.repeat(32)],
            ['31 bytes', 'ab'.repeat(31)],
            ['33 bytes', 'ab'.repeat(33)],
            ['non-hex characters', 'zz'.repeat(32)],
            ['an empty string', ''],
        ])('rejects %s', (_label, input) => {
            expect(() => parseEthereumPrivateKey(input)).toThrow(
                InvalidPrivateKeyError,
            )
            expect(() => parseEthereumPrivateKey(`0x${input}`)).toThrow(
                InvalidPrivateKeyError,
            )
        })

        it.each([
            ['1', hex32(1n)],
            ['n - 1', hex32(ORDER - 1n)],
        ])('accepts the range boundary %s', (_label, input) => {
            expect(parseEthereumPrivateKey(input)).toHaveLength(32)
        })

        it('accepts the key with and without the 0x prefix, yielding the same bytes', () => {
            const key = ANVIL_DEV_MNEMONIC_VECTOR.privateKeys[0]

            expect(parseEthereumPrivateKey(key)).toEqual(
                parseEthereumPrivateKey(key.slice(2)),
            )
        })

        it('round-trips through formatEthereumPrivateKey to lowercase 0x hex', () => {
            const upper = `0x${ANVIL_DEV_MNEMONIC_VECTOR.privateKeys[1].slice(2).toUpperCase()}`

            expect(
                formatEthereumPrivateKey(parseEthereumPrivateKey(upper)),
            ).toBe(ANVIL_DEV_MNEMONIC_VECTOR.privateKeys[1])
        })
    })

    it('imports to the address cast derives from the same key', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const key = ANVIL_DEV_MNEMONIC_VECTOR.privateKeys[1]

        const account = await createRawKeyEvmAccount(env, key)

        // Oracle parity: cast, and the published vector.
        expect(account.address).toBe(await castAddressFromPrivateKey(key))
        expect(account.address).toBe(ANVIL_DEV_MNEMONIC_VECTOR.addresses[1])
    })

    // credentialScheme resolves a standalone local key through a null-seed key
    // kind, and ethereumLocalKeyKinds declares only the BIP-39 kind, so the
    // signing machine throws CannotSignError for an imported EVM key.
    it.fails('signs a transfer the node accepts as declared (finding: a raw-key EVM account cannot be signed with, so an imported private key can receive but never send)', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const sender = await createRawKeyEvmAccount(env)
        const recipient = await createRawKeyEvmAccount(env)
        const wei = 10n ** 16n
        await fundEvmAccount(env, sender.address, 10n ** 18n)

        const [unsigned] = await createEvmTransferAdapter(
            env.ctx,
            env.evmChain,
        ).build(
            {
                kind: 'transfer',
                from: sender.address,
                to: recipient.address,
                assetRef: env.evmChain.descriptor.nativeAsset.ref,
                amount: new Decimal(wei.toString()),
            },
            { scope: env.scope },
        )
        const { transaction } = unsigned.payload as EthereumTransactionPayload
        const raw = await signTransactionWithApp(env, sender, unsigned)
        const { hash } = await broadcastAndConfirm(env, raw)

        // Node acceptance: the node recovers the sender from the signature.
        await expectEvmConformant({
            env,
            intent: {
                chainId: EVMNET.ethereum.eip155ChainId,
                from: sender.address,
                nonce: 0,
                to: recipient.address,
                value: wei,
                gas: transaction.gas!,
                maxFeePerGas: transaction.maxFeePerGas!,
                maxPriorityFeePerGas: transaction.maxPriorityFeePerGas!,
            },
            raw,
            hash,
        })
        expect(await nativeBalanceOf(env, recipient.address)).toBe(wei)
    })
})
