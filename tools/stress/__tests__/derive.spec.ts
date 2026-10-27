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

import { createPublicKey, verify } from 'node:crypto'
import algosdk from 'algosdk'
import { describe, expect, it } from 'vitest'
import { deriveAddresses, hdSigner } from '../derive'

// The same published vectors packages/chain-algorand pins the app's own derivation to.
// Public test phrases: derive from them, never fund them.
const PARITY_MNEMONIC =
    'champion say kitchen sock defense example mesh body sample artwork warfare canvas item recall cheese total floor cycle such asthma okay immense lake street'
const PARITY_ADDRESS =
    'RP35URKAEVP6PA3WIJGDGA3FZKNV76E7Y2QZPEJ4TDLV72T326B3IOFX7A'

const USER_MNEMONIC =
    'achieve plunge scare have music possible will garden expect kangaroo impulse deny obvious inhale expand process betray voice crash insane electric mean test rude'
const MASTER_ADDRESS =
    'EV37KES2XMAYPUQ5YT5T62RUC5LHNKERPH5QCAJFQF3735U7SE6BU5UQWM'
const SECOND_ACCOUNT_ADDRESS =
    'CBLWUBRWCWNKZ2Y2Q5HFKN7XISNBVAN47422MZOKH5OGCZ3H5JYLTDPLOA'

describe('deriveAddresses', () => {
    it('matches the native apps at account 0', async () => {
        expect(await deriveAddresses(PARITY_MNEMONIC, 1)).toEqual([
            PARITY_ADDRESS,
        ])
    })

    it("derives the app's accounts in index order", async () => {
        const addresses = await deriveAddresses(USER_MNEMONIC, 2)

        expect(addresses).toEqual([MASTER_ADDRESS, SECOND_ACCOUNT_ADDRESS])
    })

    it('gives every account its own address', async () => {
        const addresses = await deriveAddresses(USER_MNEMONIC, 10)

        expect(new Set(addresses).size).toBe(10)
    })
})

// DER prefix of an Ed25519 public key, so a raw 32-byte key can be handed to node:crypto.
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

describe('hdSigner', () => {
    const payment = (sender: string) =>
        algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender,
            receiver: sender,
            amount: 0,
            suggestedParams: {
                fee: 1000,
                flatFee: true,
                firstValid: 1,
                lastValid: 1000,
                genesisHash: new Uint8Array(32),
                genesisID: 'testnet-v1.0',
            },
        })

    it('signs as the address the app derives for that account', async () => {
        const { address } = await hdSigner(USER_MNEMONIC, 1)

        expect(address).toBe(SECOND_ACCOUNT_ADDRESS)
    })

    it('produces a signature that verifies against that address', async () => {
        const { address, signer } = await hdSigner(USER_MNEMONIC, 1)
        const txn = payment(address)

        const [signed] = await signer([txn], [0])

        const { sig } = algosdk.decodeSignedTransaction(signed)
        expect(sig).toHaveLength(64)
        const key = createPublicKey({
            key: Buffer.concat([
                ED25519_SPKI_PREFIX,
                Buffer.from(algosdk.decodeAddress(address).publicKey),
            ]),
            format: 'der',
            type: 'spki',
        })
        expect(verify(null, txn.bytesToSign(), key, sig!)).toBe(true)
    })

    it('signs only the transactions it is asked to', async () => {
        const { address, signer } = await hdSigner(USER_MNEMONIC, 0)

        const signed = await signer([payment(address), payment(address)], [1])

        expect(signed).toHaveLength(1)
    })
})
