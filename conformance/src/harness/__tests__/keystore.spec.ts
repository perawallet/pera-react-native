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

import {
    BIP32DerivationType,
    fromSeed,
    KeyContext,
    XHDWalletAPI,
} from '@algorandfoundation/xhd-wallet-api'
import { mnemonicToSeed } from '@scure/bip39'
import algosdk from 'algosdk'
import { generateKey } from 'falcon-1024'
import nacl from 'tweetnacl'
import { describe, expect, it } from 'vitest'

import { derivePQKeygenSeed } from '@perawallet/wallet-core-blockchain/pq/derivation'

import {
    createAlgo25Account,
    createHdAccount,
    createMultisigAccount,
    createQuantumAccount,
    fundAccount,
} from '../accounts'
import { getConformanceClient } from '../client'
import { createConformanceKeyStore } from '../keystore'

describe('conformance keystore', () => {
    it('derives an algo25 address matching algosdk and signs like nacl', async () => {
        const ks = await createConformanceKeyStore()
        const account = await createAlgo25Account(ks)

        const expected = algosdk.mnemonicToSecretKey(account.mnemonic)
        expect(account.address).toBe(expected.addr.toString())

        const payload = new Uint8Array([1, 2, 3, 4])
        const signature = await ks.sign(account.keyId, payload)
        expect(signature).toEqual(nacl.sign.detached(payload, expected.sk))
    })

    it('derives a quantum key matching falcon-1024 directly', async () => {
        const ks = await createConformanceKeyStore()
        const account = await createQuantumAccount(ks)

        const seed = algosdk.seedFromMnemonic(account.mnemonic)
        const expected: { publicKey: Uint8Array } = generateKey(
            derivePQKeygenSeed(seed, 'falcon1024'),
        )

        const exported = await ks.export(account.keyId)
        expect(exported.publicKey).toEqual(expected.publicKey)
        expect(exported.publicKey?.[0]).toBe(10)
    })

    it('derives an HD address matching the XHD library at the same coordinates', async () => {
        const ks = await createConformanceKeyStore()
        const account = await createHdAccount(ks, undefined, 3)

        const rootKey = fromSeed(
            Buffer.from(await mnemonicToSeed(account.mnemonic)),
        )
        const expected = await new XHDWalletAPI().keyGen(
            rootKey,
            KeyContext.Address,
            0,
            3,
            BIP32DerivationType.Peikert,
        )

        expect(account.address).toBe(algosdk.encodeAddress(expected))
    })

    it('exposes the Falcon, XHD and Algo25 shims', async () => {
        const ks = await createConformanceKeyStore()

        const algorithms = ks.store.state.algorithms?.map(
            capability => `${capability.algorithm}:${capability.source}`,
        )

        expect(algorithms).toEqual(
            expect.arrayContaining([
                'Falcon-1024:shim',
                'BIP32-Ed25519:shim',
                'Algo25:shim',
            ]),
        )
    })

    // The Falcon and XHD shims wipe the material buffer they are handed, so a
    // driver that hands out one cached plaintext twice signs correctly once and
    // then emits garbage from an all-zero key.
    it('re-decrypts material on every use, so repeated signing stays correct', async () => {
        const ks = await createConformanceKeyStore()
        const quantum = await createQuantumAccount(ks)
        const hd = await createHdAccount(ks)
        const payload = new Uint8Array([9, 8, 7, 6])

        const quantumSignatures = [
            await ks.sign(quantum.keyId, payload),
            await ks.sign(quantum.keyId, payload),
        ]
        const hdSignatures = [
            await ks.sign(hd.keyId, payload),
            await ks.sign(hd.keyId, payload),
        ]

        expect(quantumSignatures[0]).toEqual(quantumSignatures[1])
        expect(hdSignatures[0]).toEqual(hdSignatures[1])
        expect(
            await ks.verify(quantum.keyId, payload, quantumSignatures[1]),
        ).toBe(true)
        expect(await ks.verify(hd.keyId, payload, hdSignatures[1])).toBe(true)
    })

    it('funds an account on LocalNet through the app-built client', async () => {
        const ks = await createConformanceKeyStore()
        const account = await createAlgo25Account(ks)

        await fundAccount(account.address, 5_000_000n)

        const info = await getConformanceClient().account.getInformation(
            account.address,
        )
        expect(info.balance.microAlgo).toBe(5_000_000n)
    })

    it('builds a multisig address from its members in order', async () => {
        const ks = await createConformanceKeyStore()
        const members = [
            await createAlgo25Account(ks),
            await createAlgo25Account(ks),
        ]

        const multisig = createMultisigAccount(members, 2)
        const reversed = createMultisigAccount([...members].reverse(), 2)

        expect(multisig.address).toBe(
            algosdk
                .multisigAddress({
                    version: 1,
                    threshold: 2,
                    addrs: members.map(member => member.address),
                })
                .toString(),
        )
        expect(reversed.address).not.toBe(multisig.address)
    })
})
