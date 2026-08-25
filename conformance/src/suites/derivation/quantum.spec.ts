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

import { derivePQKeygenSeed } from '@perawallet/wallet-core-blockchain/pq/derivation'
import { getPQProvider } from '@perawallet/wallet-core-kms/crypto/pq'
import { quantumAddressCandidates } from '@perawallet/wallet-core-kms/crypto/quantumAddressCandidates'

import {
    createAlgo25Account,
    createQuantumAccount,
    fundAccount,
} from '../../harness/accounts'
import {
    algokeyPqCheckAddress,
    algokeyQuantumAddressFromMnemonic,
} from '../../harness/algokey'
import { getConformanceClient } from '../../harness/client'
import { createConformanceKeyStore } from '../../harness/keystore'
import { GO_ALGORAND_PQ_VECTOR } from '../../vectors/knownAnswerVectors'

/** Falcon-1024's NIST public-key header byte; `164` was the on-device defect adjacent to PERA-4972. */
const FALCON_1024_NIST_HEADER_BYTE = 10

describe('quantum derivation conformance', () => {
    it('matches the algokey oracle', async () => {
        const ks = await createConformanceKeyStore()
        const account = await createQuantumAccount(ks)

        const oracle = await algokeyQuantumAddressFromMnemonic(account.mnemonic)
        expect(account.address).toBe(oracle.address)
    })

    it('funds the algokey-derived address and the chain credits the app-derived one', async () => {
        const ks = await createConformanceKeyStore()
        const account = await createQuantumAccount(ks)

        const oracle = await algokeyQuantumAddressFromMnemonic(account.mnemonic)
        await fundAccount(oracle.address, 1_000_000n)

        // Funding the oracle's address and querying the app's makes this leg
        // sensitive to a wrong derivation (PERA-4972's failure mode): if the two
        // diverged, this account would show a zero balance instead of the
        // assertion failing to even find a mismatched address.
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

    it('rejects a non-PQ address via algokey pq check-address', async () => {
        const ks = await createConformanceKeyStore()
        const account = await createAlgo25Account(ks)

        expect(await algokeyPqCheckAddress(account.address)).toBe(false)
    })

    it('reproduces the go-algorand pinned vector', async () => {
        const ks = await createConformanceKeyStore()
        const mnemonic = algosdk.mnemonicFromSeed(GO_ALGORAND_PQ_VECTOR.entropy)
        const account = await createQuantumAccount(ks, mnemonic)

        expect(account.address).toBe(GO_ALGORAND_PQ_VECTOR.address)
    })

    // The app derives quantum keys in two places that must never disagree:
    // the keystore mints the signing child, and `getPQProvider()` derives an
    // in-memory keypair for the import probe and the legacy-account notice.
    // Nothing else compares them — a probe pointed at the wrong address shows
    // an existing account as new, which is how PERA-4972 presented.
    it("matches the keystore's minted key with the provider the import probe uses", async () => {
        const ks = await createConformanceKeyStore()
        const account = await createQuantumAccount(ks)
        const entropy = algosdk.seedFromMnemonic(account.mnemonic)

        const { publicKey } = getPQProvider().generateKeypairFromSeed(
            derivePQKeygenSeed(entropy),
        )
        const { publicKey: minted } = await ks.export(account.keyId)

        expect(minted).toEqual(publicKey)
    })

    it('offers the canonical candidate as the address the chain actually credits', async () => {
        const ks = await createConformanceKeyStore()
        const account = await createQuantumAccount(ks)
        const entropy = algosdk.seedFromMnemonic(account.mnemonic)

        const candidates = quantumAddressCandidates(entropy)
        const canonical = candidates.find(
            candidate => candidate.derivation === 'pqk1',
        )
        const legacy = candidates.find(
            candidate => candidate.derivation !== 'pqk1',
        )

        expect(canonical?.address).toBe(account.address)
        // The two derivations must not collapse onto one address, or the
        // legacy-account probe would be checking the same account twice and
        // could never tell a pre-fix account from a new one.
        expect(legacy?.address).not.toBe(canonical?.address)

        // Funding the LEGACY candidate is the falsifier: the account the app
        // actually mints must be a different one the chain does not credit.
        // Funding the canonical one would only prove `fundAccount` works,
        // since the assertion above already made the two addresses equal.
        await fundAccount(legacy!.address, 1_000_000n)
        const [legacyInfo, canonicalInfo] = await Promise.all([
            getConformanceClient()
                .client.algod.accountInformation(legacy!.address)
                .do(),
            getConformanceClient()
                .client.algod.accountInformation(account.address)
                .do(),
        ])
        expect(BigInt(legacyInfo.amount)).toBe(1_000_000n)
        expect(BigInt(canonicalInfo.amount)).toBe(0n)
    })
})
