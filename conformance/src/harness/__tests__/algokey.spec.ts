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
import { beforeAll, describe, expect, it } from 'vitest'

import {
    algokeyAddressFromMnemonic,
    algokeyMultisigSign,
    algokeyQuantumAddressFromMnemonic,
    algokeyQuantumSign,
    algokeySign,
    isAlgokeyAvailable,
} from '../algokey'
import { LOCALNET_ALGOD_URL, LOCALNET_TOKEN } from '../localnet'

describe('algokey oracle', () => {
    it('is available in the running LocalNet container', async () => {
        expect(await isAlgokeyAvailable()).toBe(true)
    })

    it('derives the same ed25519 address as algosdk', async () => {
        const account = algosdk.generateAccount()
        const mnemonic = algosdk.secretKeyToMnemonic(account.sk)

        expect(await algokeyAddressFromMnemonic(mnemonic)).toBe(
            account.addr.toString(),
        )
    })

    it('derives a quantum address with the NIST header byte', async () => {
        const account = algosdk.generateAccount()
        const mnemonic = algosdk.secretKeyToMnemonic(account.sk)

        const result = await algokeyQuantumAddressFromMnemonic(mnemonic)

        expect(result.address).toMatch(/^[A-Z2-7]{58}$/)
        expect(result.publicKey).toHaveLength(1793)
        expect(result.publicKey[0]).toBe(10)
    })
})

describe('algokey oracle — signing helpers', () => {
    let suggestedParams: Parameters<
        typeof algosdk.makePaymentTxnWithSuggestedParamsFromObject
    >[0]['suggestedParams']

    beforeAll(async () => {
        const algod = new algosdk.Algodv2(
            LOCALNET_TOKEN,
            LOCALNET_ALGOD_URL,
            undefined,
        )
        suggestedParams = await algod.getTransactionParams().do()
    })

    it('signs a payment with an ed25519 key, byte-identical to algosdk', async () => {
        const account = algosdk.generateAccount()
        const mnemonic = algosdk.secretKeyToMnemonic(account.sk)
        const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: account.addr,
            receiver: account.addr,
            amount: 0n,
            suggestedParams,
        })

        const signed = await algokeySign({
            mnemonic,
            unsignedTxn: algosdk.encodeUnsignedTransaction(txn),
        })

        expect(signed).toEqual(txn.signTxn(account.sk))
    })

    it('signs a payment with a quantum key, matching the address oracle’s public key', async () => {
        const account = algosdk.generateAccount()
        const mnemonic = algosdk.secretKeyToMnemonic(account.sk)
        const { publicKey, salt } =
            await algokeyQuantumAddressFromMnemonic(mnemonic)
        const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: account.addr,
            receiver: account.addr,
            amount: 0n,
            suggestedParams,
        })

        const signed = await algokeyQuantumSign({
            mnemonic,
            unsignedTxn: algosdk.encodeUnsignedTransaction(txn),
        })
        const decoded = algosdk.decodeSignedTransaction(signed)

        expect(decoded.pqsig).toBeDefined()
        expect(decoded.pqsig?.pk).toEqual(publicKey)
        expect(decoded.pqsig?.slt).toBe(salt)
        expect(decoded.pqsig?.sig.length).toBeGreaterThan(0)
    })

    it('signs a payment with a multisig key, byte-identical to algosdk', async () => {
        const signer = algosdk.generateAccount()
        const cosigner = algosdk.generateAccount()
        const metadata: algosdk.MultisigMetadata = {
            version: 1,
            threshold: 2,
            addrs: [signer.addr.toString(), cosigner.addr.toString()],
        }
        const msigAddress = algosdk.multisigAddress(metadata)
        const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: msigAddress,
            receiver: msigAddress,
            amount: 0n,
            suggestedParams,
        })
        const preimage = algosdk.createMultisigTransaction(txn, metadata)

        const signed = await algokeyMultisigSign({
            mnemonic: algosdk.secretKeyToMnemonic(signer.sk),
            unsignedTxn: preimage,
        })

        expect(signed).toEqual(
            algosdk.signMultisigTransaction(txn, metadata, signer.sk).blob,
        )
    })
})
