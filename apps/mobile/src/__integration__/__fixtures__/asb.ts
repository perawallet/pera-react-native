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
import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { mnemonicToEntropy } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { seedFromMnemonic } from 'algosdk'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'

import { ALGO25_TEST_MNEMONIC, ALGO25_TEST_ADDRESS } from './onboarding'

// Standard BIP-39 zero-entropy phrase — 12 words decoding to 16 zero bytes.
// Used as the ASB "recovery key" in flow tests.
export const ASB_RECOVERY_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

export const ASB_RECOVERY_MNEMONIC_WORDS = ASB_RECOVERY_MNEMONIC.split(' ')

// 12 valid BIP-39 words whose combination fails the checksum. Used to
// exercise the wrong-key path without tripping the input validator.
export const ASB_WRONG_RECOVERY_MNEMONIC_WORDS = Array.from(
    { length: 12 },
    () => 'abandon',
)

// A second valid base32 Algorand address used as a watch entry in the
// fixture payload. Any well-formed address would do; this one is reused
// from the existing onboarding fixtures as a rekey target.
export const ASB_WATCH_ADDRESS =
    'CBLWUBRWCWNKZ2Y2Q5HFKN7XISNBVAN47422MZOKH5OGCZ3H5JYLTDPLOA'

const CONTEXT = new TextEncoder().encode('Algorand export 1.0')

const buildCipherKey = (mnemonic: string): Uint8Array => {
    const seed = mnemonicToEntropy(mnemonic, wordlist)
    return hmac(sha256, CONTEXT, seed)
}

const sealPayload = (plaintext: Uint8Array, key: Uint8Array): Uint8Array => {
    const nonce = nacl.randomBytes(24)
    // jsdom's TextEncoder returns a Uint8Array from a different realm than
    // node's globals; tweetnacl's `instanceof Uint8Array` check fails on
    // those. The integration setup aliases `globalThis.Uint8Array` to node's
    // version, but we still wrap defensively for safety in any environment.
    const box = nacl.secretbox(Uint8Array.from(plaintext), nonce, key)
    const out = new Uint8Array(24 + box.length)
    out.set(nonce, 0)
    out.set(box, 24)
    return out
}

type FixtureAccount = {
    address: string
    name?: string | null
    /** Defaults to `single` when `seed` is provided, otherwise `watch`. */
    kind?: 'single' | 'watch'
    /** 32-byte Algorand seed for single accounts. */
    seed?: Uint8Array
}

/**
 * Build a real ARC-35 backup file for a list of accounts.
 *
 *   1. Encode `{accounts, provider_name, device_id}` as JSON
 *   2. Encrypt with the cipher key derived from `recoveryMnemonic`
 *   3. Prepend the 24-byte nonce and base64-encode
 *   4. Wrap in the ARC-35 envelope JSON
 *   5. Base64-encode the envelope JSON
 *
 * The returned string is exactly what the user would have copy-pasted from
 * the legacy export — the production parser must decode it byte-for-byte.
 */
export const buildAsbBackupFile = ({
    accounts,
    recoveryMnemonic = ASB_RECOVERY_MNEMONIC,
    providerName = 'Pera Wallet (test)',
    deviceId = 'test-device-id',
}: {
    accounts: FixtureAccount[]
    recoveryMnemonic?: string
    providerName?: string | null
    deviceId?: string | null
}): string => {
    const cipherKey = buildCipherKey(recoveryMnemonic)

    const payloadAccounts = accounts.map(account => {
        const kind = account.kind ?? (account.seed ? 'single' : 'watch')
        if (kind === 'watch') {
            return {
                address: account.address,
                name: account.name ?? null,
                account_type: 'watch',
                private_key: '',
            }
        }
        if (!account.seed) {
            throw new Error('Single ASB fixture account requires a seed')
        }
        // Single accounts encode the full 64-byte tweetnacl secret key
        // (seed || pubKey) — that's what the legacy iOS/Android exporter
        // wrote. The parser reads only the first 32 bytes (the seed) but
        // accepts the full 64.
        const keypair = nacl.sign.keyPair.fromSeed(
            Uint8Array.from(account.seed),
        )
        return {
            address: account.address,
            name: account.name ?? null,
            account_type: 'single',
            private_key: encodeToBase64(keypair.secretKey),
        }
    })

    const plaintext = new TextEncoder().encode(
        JSON.stringify({
            accounts: payloadAccounts,
            provider_name: providerName,
            device_id: deviceId,
        }),
    )

    const ciphertext = encodeToBase64(
        sealPayload(Uint8Array.from(plaintext), cipherKey),
    )

    const envelope = {
        version: '1.0',
        suite: 'HMAC-SHA256:sodium_secretbox_easy',
        ciphertext,
    }

    return encodeToBase64(new TextEncoder().encode(JSON.stringify(envelope)))
}

/**
 * The canonical single-account fixture: backed by `ALGO25_TEST_MNEMONIC`, so
 * the recovered address matches `ALGO25_TEST_ADDRESS` (same pin used across
 * the algo25 onboarding tests).
 */
export const buildSingleAccountAsbBackup = (
    overrides?: Parameters<typeof buildAsbBackupFile>[0]['accounts'][number],
): string =>
    buildAsbBackupFile({
        accounts: [
            {
                address: ALGO25_TEST_ADDRESS,
                name: 'Algo25 from ASB',
                seed: seedFromMnemonic(ALGO25_TEST_MNEMONIC),
                ...overrides,
            },
        ],
    })

/** Single + watch combo, mirroring the typical legacy export. */
export const buildMixedAsbBackup = (): string =>
    buildAsbBackupFile({
        accounts: [
            {
                address: ALGO25_TEST_ADDRESS,
                name: 'Algo25 from ASB',
                seed: seedFromMnemonic(ALGO25_TEST_MNEMONIC),
            },
            {
                address: ASB_WATCH_ADDRESS,
                name: 'Watcher',
                kind: 'watch',
            },
        ],
    })
