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

import { describe, it, expect } from 'vitest'
import {
    LogicSig,
    LogicSigAccount,
    generateAccount,
    decodeAddress,
} from 'algosdk'
import {
    encodeDelegatedLsig,
    encodeDelegatedLsigAccount,
    LsigSignatureVerificationError,
} from '../lsig'

// The delegated-LogicSig signature is raw ed25519 over `"Program" || program`
// (NO "MX" domain prefix — that is `signBytes`, for arbitrary data). Our real
// path produces this via KMS; here algosdk's `LogicSig.signProgram` is the
// reference primitive.
const signProgram = (program: Uint8Array, sk: Uint8Array): Uint8Array =>
    new LogicSig(program).signProgram(sk)

describe('encodeDelegatedLsig', () => {
    it('round-trips program and signature through algosdk msgpack', () => {
        const program = new Uint8Array([0x04, 0x81, 0x01])
        const sig = new Uint8Array(64).fill(42)

        const encoded = encodeDelegatedLsig(program, sig)
        const decoded = LogicSig.fromByte(encoded)

        expect([...decoded.logic]).toEqual([...program])
        expect([...(decoded.sig ?? [])]).toEqual([...sig])
        expect(decoded.msig).toBeUndefined()
    })
})

describe('encodeDelegatedLsigAccount', () => {
    // A valid, cheap program: `int 1`.
    const program = new Uint8Array([0x06, 0x81, 0x01])

    it('produces bytes identical to algosdk LogicSigAccount.sign', () => {
        const account = generateAccount()
        // Our path: sign "Program" || program externally, then assemble.
        const sig = signProgram(program, account.sk)
        const ours = encodeDelegatedLsigAccount(
            program,
            sig,
            account.addr.toString(),
        )

        // algosdk's own delegated-sign path over the same account/program.
        const reference = new LogicSigAccount(program)
        reference.sign(account.sk)

        expect([...ours]).toEqual([...reference.toByte()])
    })

    it('records the signer public key (sigkey) on round-trip', () => {
        const account = generateAccount()
        const sig = signProgram(program, account.sk)

        const decoded = LogicSigAccount.fromByte(
            encodeDelegatedLsigAccount(program, sig, account.addr.toString()),
        )

        expect([...(decoded.sigkey ?? [])]).toEqual([
            ...decodeAddress(account.addr.toString()).publicKey,
        ])
        expect([...decoded.lsig.logic]).toEqual([...program])
        expect(decoded.verify()).toBe(true)
    })

    it('throws when the signature does not verify against the signer', () => {
        const signer = generateAccount()
        const other = generateAccount()
        // Signature produced by a different key than the claimed signer.
        const sig = signProgram(program, other.sk)

        expect(() =>
            encodeDelegatedLsigAccount(program, sig, signer.addr.toString()),
        ).toThrow(LsigSignatureVerificationError)
    })
})
