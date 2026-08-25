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

import algosdk from 'algosdk'
import nacl from 'tweetnacl'
import { describe, expect, it } from 'vitest'

import {
    createAlgo25Account,
    createHdAccount,
    createMultisigAccount,
    createQuantumAccount,
    fundAccount,
} from '../accounts'
import { accountInformationOf, getConformanceClient } from '../client'
import { createConformanceKeyStore } from '../keystore'

/**
 * Tests of the HARNESS, not of the app — every other file in this suite rests
 * on these holding.
 *
 * The distinction matters for what belongs here. Whether the app derives the
 * right address, signs the right preimage, or builds the right envelope is
 * proven in `src/suites/**`, against an independent oracle and a real node.
 * What this file checks is narrower and unglamorous: that the in-memory
 * driver standing in for the React Native Keychain behaves like it, that the
 * optional shims actually loaded, and that the accounts the harness hands out
 * are the accounts the chain knows about. A failure in any of those would
 * make the suites above green for the wrong reason rather than red.
 */
describe('conformance keystore harness', () => {
    // Loading is optional and silent: a shim that failed to load is simply
    // absent from `algorithms`, and every quantum or HD suite downstream would
    // then fail to mint a key rather than reporting a derivation problem.
    it('loaded the Falcon, XHD and Algo25 shims', async () => {
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
    // then emits garbage from an all-zero key. That would surface downstream as
    // an intermittent bad signature attributed to the app.
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

    // The sealed material must correspond to the address the harness reports,
    // or a suite could "prove" a signature for an account the chain never
    // credits. Verified with tweetnacl rather than the keystore's own verifier
    // so the check does not rest on the component under test.
    it('seals a key that signs for the address it hands back', async () => {
        const ks = await createConformanceKeyStore()
        const account = await createAlgo25Account(ks)

        const payload = new Uint8Array([1, 2, 3, 4])
        const signature = await ks.sign(account.keyId, payload)

        expect(
            nacl.sign.detached.verify(
                payload,
                signature,
                algosdk.Address.fromString(account.address).publicKey,
            ),
        ).toBe(true)
    })

    it('hands out accounts the chain credits, read back through the app model', async () => {
        const ks = await createConformanceKeyStore()
        const account = await createAlgo25Account(ks)

        await fundAccount(account.address, 5_000_000n)

        const info = await accountInformationOf(account.address)
        expect(info.amount).toBe(5_000_000n)
        expect(info.address.toString()).toBe(account.address)
        // Never rekeyed, so the app model must report no auth address rather
        // than echoing the account's own.
        expect(info.authAddress).toBeUndefined()
    })

    // Member order is part of the multisig preimage, so a harness that
    // silently normalised it would build a different account than the one the
    // suites think they are testing.
    it('keeps multisig member order significant', async () => {
        const ks = await createConformanceKeyStore()
        const members = [
            await createAlgo25Account(ks),
            await createAlgo25Account(ks),
        ]

        const multisig = createMultisigAccount(members, 2)
        const reversed = createMultisigAccount([...members].reverse(), 2)

        expect(reversed.address).not.toBe(multisig.address)
        expect(multisig.walletAccount.multisigDetails.addresses).toEqual(
            members.map(member => member.address),
        )
    })

    it('builds its algod client from the app factory, pointed at LocalNet', async () => {
        const status = await getConformanceClient().client.algod.status().do()

        expect(status.lastRound).toBeGreaterThanOrEqual(0n)
    })
})
