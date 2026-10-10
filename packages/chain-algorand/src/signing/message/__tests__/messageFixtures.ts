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

import nacl from 'tweetnacl'
import { sha256 } from '@noble/hashes/sha2.js'
import { canonify } from 'canonify'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { AuthDataPayload } from '@perawallet/wallet-core-signing'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import { encodeAlgorandAddress } from '../../../blockchain'
import { ARC60_SCOPE_AUTH } from '../arc60'

export const messageKeyPair = nacl.sign.keyPair.fromSeed(
    new Uint8Array(32).fill(7),
)

const addressOf = (publicKey: Uint8Array) => encodeAlgorandAddress(publicKey)

export const messageAccount = {
    address: addressOf(messageKeyPair.publicKey),
    keyPairId: 'message-key',
    custody: { kind: 'local', seed: null },
} as unknown as WalletAccount

export const otherMessageAddress = addressOf(
    nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(8)).publicKey,
)

export const signWithMessageKey = (payloads: Uint8Array[]): Uint8Array[] =>
    payloads.map(payload =>
        nacl.sign.detached(payload, messageKeyPair.secretKey),
    )

const DOMAIN = 'arc60.io'

type SiwaOverrides = Record<string, unknown>

// A canonical SIWA with no timestamps, so a fixed signature stays valid.
export const siwaAuthPayload = (
    signer: string,
    overrides: SiwaOverrides = {},
): AuthDataPayload => {
    const siwa: SiwaOverrides = {
        domain: DOMAIN,
        account_address: signer,
        uri: 'https://arc60.io/login',
        version: '1',
        nonce: 'abc123',
        chain_id: 'algorand:mainnet',
        type: 'ed25519',
        statement: 'Sign in to arc60.io',
        ...overrides,
    }
    for (const key of Object.keys(siwa)) {
        if (siwa[key] === undefined) delete siwa[key]
    }
    return {
        authData: {
            data: encodeToBase64(new TextEncoder().encode(canonify(siwa)!)),
            signer,
            domain: DOMAIN,
            authenticatorData: new Uint8Array([
                ...sha256(new TextEncoder().encode(DOMAIN)),
                0x05,
            ]),
        },
        metadata: { scope: ARC60_SCOPE_AUTH, encoding: 'base64' },
    }
}
