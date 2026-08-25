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

import { createHash } from 'node:crypto'

import algosdk from 'algosdk'
import { describe, expect, it } from 'vitest'

import { generateMultisigAddress } from '@perawallet/wallet-core-blockchain/utils/multisig'

import {
    createAlgo25Account,
    createMultisigAccount,
    fundAccount,
    type ConformanceAccount,
} from '../../harness/accounts'
import { base32Encode } from '../../harness/base32'
import { getConformanceClient } from '../../harness/client'
import { createConformanceKeyStore } from '../../harness/keystore'

const MULTISIG_ADDR_PREFIX = new TextEncoder().encode('MultisigAddr')

const sha512_256 = (bytes: Uint8Array): Uint8Array =>
    new Uint8Array(createHash('sha512-256').update(bytes).digest())

/**
 * Independent re-implementation of the Algorand multisig address preimage —
 * `SHA512_256("MultisigAddr" || version || threshold || pk1 || pk2 || ...)`,
 * checksummed and base32-encoded from scratch — built from the spec text, not
 * a second call into algosdk's own `multisigAddress`/`Address` machinery. Every
 * step here (hashing via `node:crypto`, the checksum, the base32 alphabet walk)
 * is separate code from what `generateMultisigAddress` calls.
 */
const independentMultisigAddress = (
    version: number,
    threshold: number,
    publicKeys: Uint8Array[],
): string => {
    const preimage = new Uint8Array(
        MULTISIG_ADDR_PREFIX.length + 2 + 32 * publicKeys.length,
    )
    preimage.set(MULTISIG_ADDR_PREFIX, 0)
    preimage[MULTISIG_ADDR_PREFIX.length] = version
    preimage[MULTISIG_ADDR_PREFIX.length + 1] = threshold
    publicKeys.forEach((pk, i) =>
        preimage.set(pk, MULTISIG_ADDR_PREFIX.length + 2 + i * 32),
    )

    const hash = sha512_256(preimage)
    const checksum = sha512_256(hash).slice(28, 32)
    return base32Encode(new Uint8Array([...hash, ...checksum]))
}

// Three arbitrary, fixed addresses — never funded directly, only used as
// multisig preimage inputs — so the parity assertion below is reproducible
// run to run rather than re-rolling random members every time.
const FIXED_MEMBERS = [
    'B3FCOSKVDPADAVJ6LXZKAMXDC4DFNLPOINGM2ZDSAKEBVG4LJVRTPJ22QY',
    'SMYOGL34R6IPDMI6TGHYDDWIGH6Z3EDGTNDKLWYVHPGDTW5D5XAYGKY25U',
    'YUJXOZQQPU4ECK2MME4UM5IALLPHH6R2RAVUGKAXCE5XKJSLXNUMPW5DHQ',
]

describe('multisig derivation conformance', () => {
    it('matches an independent multisig-preimage implementation for a fixed member set', () => {
        const version = 1
        const threshold = 2
        const publicKeys = FIXED_MEMBERS.map(
            addr => algosdk.Address.fromString(addr).publicKey,
        )

        const address = generateMultisigAddress(
            version,
            threshold,
            FIXED_MEMBERS,
        )

        expect(address).toBe(
            independentMultisigAddress(version, threshold, publicKeys),
        )
    })

    it('funds the independently-derived address and the chain credits the app-derived one', async () => {
        const ks = await createConformanceKeyStore()
        const members: ConformanceAccount[] = [
            await createAlgo25Account(ks),
            await createAlgo25Account(ks),
            await createAlgo25Account(ks),
        ]
        const threshold = 2
        const multisig = createMultisigAccount(members, threshold)
        const publicKeys = members.map(
            member => algosdk.Address.fromString(member.address).publicKey,
        )
        const oracleAddress = independentMultisigAddress(
            multisig.version,
            threshold,
            publicKeys,
        )

        await fundAccount(oracleAddress, 1_000_000n)

        // Funding the independently-derived address and querying the app's
        // (`createMultisigAccount`, which the app's real multisig flows also
        // build addresses through) makes this leg sensitive to a wrong
        // derivation: if the two diverged, the queried account would show a
        // zero balance instead of the assertion failing to even find a
        // mismatched address.
        const info = await getConformanceClient()
            .client.algod.accountInformation(multisig.address)
            .do()

        expect(BigInt(info.amount)).toBe(1_000_000n)
    })
})
