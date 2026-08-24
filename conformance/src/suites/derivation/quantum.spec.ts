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
import { describe, expect, it } from 'vitest'

import { createQuantumAccount, fundAccount } from '../../harness/accounts'
import {
    algokeyPqCheckAddress,
    algokeyQuantumAddressFromMnemonic,
} from '../../harness/algokey'
import { getConformanceClient } from '../../harness/client'
import { createConformanceKeyStore } from '../../harness/keystore'
import { GO_ALGORAND_PQ_VECTOR } from '../../vectors/goAlgorand'

/** Falcon-1024's NIST public-key header byte; `164` was the on-device defect adjacent to PERA-4972. */
const FALCON_1024_NIST_HEADER_BYTE = 10

describe('quantum derivation conformance', () => {
    it('matches the algokey oracle', async () => {
        const ks = await createConformanceKeyStore()
        const account = await createQuantumAccount(ks)

        const oracle = await algokeyQuantumAddressFromMnemonic(account.mnemonic)
        expect(account.address).toBe(oracle.address)
    })

    it('is the address the chain credits', async () => {
        const ks = await createConformanceKeyStore()
        const account = await createQuantumAccount(ks)
        await fundAccount(account.address, 1_000_000n)

        const info = await getConformanceClient()
            .client.algod.accountInformation(account.address)
            .do()

        expect(BigInt(info.amount)).toBe(1_000_000n)
    })

    it('derives a public key with the Falcon-1024 NIST header byte', async () => {
        const ks = await createConformanceKeyStore()
        const account = await createQuantumAccount(ks)

        const { publicKey } = await ks.export(account.keyId)
        expect(publicKey?.[0]).toBe(FALCON_1024_NIST_HEADER_BYTE)
    })

    it('is accepted by algokey pq check-address', async () => {
        const ks = await createConformanceKeyStore()
        const account = await createQuantumAccount(ks)

        expect(await algokeyPqCheckAddress(account.address)).toBe(true)
    })

    it('reproduces the go-algorand pinned vector', async () => {
        const ks = await createConformanceKeyStore()
        const mnemonic = algosdk.mnemonicFromSeed(GO_ALGORAND_PQ_VECTOR.entropy)
        const account = await createQuantumAccount(ks, mnemonic)

        expect(account.address).toBe(GO_ALGORAND_PQ_VECTOR.address)
    })
})
