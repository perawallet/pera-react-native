/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

// @vitest-environment node
// This is a fixture-generator tool, not a unit test. It runs Node crypto +
// xhd-wallet-api derivation, which fails an `instanceof Uint8Array` check
// inside `@noble/curves` 2.0.1 when running under the default jsdom
// environment (cross-realm Buffer). Node env avoids the realm mismatch.

import { writeFileSync, mkdirSync } from 'node:fs'
import { createPrivateKey, createPublicKey } from 'node:crypto'
import { resolve } from 'node:path'
import { describe, test, expect } from 'vitest'
import { entropyToMnemonic, mnemonicToSeed } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import {
    BIP32DerivationType,
    fromSeed,
    KeyContext,
    XHDWalletAPI,
} from '@algorandfoundation/xhd-wallet-api'
import { encodeAddress } from '@algorandfoundation/algokit-utils'

const HD_ENTROPY_HEX =
    '6d6967726174696f6e2d73696d756c61746f722d68642d77616c6c65742d3031'

const ALGO25_VALID_SEED_HEX =
    '6d6967726174696f6e2d73696d756c61746f722d616c676f32352d76616c6964'

const LEDGER_1_SEED_HEX =
    '6d6967726174696f6e2d73696d756c61746f722d6c65646765722d6163636f30'

const LEDGER_2_SEED_HEX =
    '6d6967726174696f6e2d73696d756c61746f722d6c65646765722d6163636f31'

const WATCH_1_SEED_HEX =
    '6d6967726174696f6e2d73696d756c61746f722d77617463682d61636e2d3031'

const WATCH_2_SEED_HEX =
    '6d6967726174696f6e2d73696d756c61746f722d77617463682d61636e2d3032'

const EXTERNAL_PARTICIPANT_SEED_HEX =
    '6d6967726174696f6e2d73696d756c61746f722d65787465726e616c2d706172'

const HD_KEY_INDEXES = [
    { account: 0, keyIndex: 0, label: 'HD_KEY_0' },
    { account: 0, keyIndex: 1, label: 'HD_KEY_1' },
    { account: 0, keyIndex: 2, label: 'HD_KEY_2' },
] as const

const OUTPUT_PATH = resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    '..',
    '..',
    'apps',
    'mobile',
    'native-modules',
    'migration',
    'android',
    'src',
    'main',
    'java',
    'com',
    'algorand',
    'perarn',
    'migration',
    'fixtures',
    'FixtureCrypto.kt',
)

const OUTPUT_PATH_SWIFT = resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    '..',
    '..',
    'apps',
    'mobile',
    'native-modules',
    'migration',
    'ios',
    'FixtureCrypto.swift',
)

const ED25519_PKCS8_PREFIX = Buffer.from([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70,
    0x04, 0x22, 0x04, 0x20,
])

const seedToPublicKey = (seed: Buffer): Buffer => {
    const pkcs8 = Buffer.concat([ED25519_PKCS8_PREFIX, seed])
    const privateKey = createPrivateKey({
        key: pkcs8,
        format: 'der',
        type: 'pkcs8',
    })
    const spki = createPublicKey(privateKey).export({
        format: 'der',
        type: 'spki',
    }) as Buffer
    return spki.subarray(spki.length - 32)
}

const sk64FromSeed = (seed: Buffer): Buffer => {
    const pubkey = seedToPublicKey(seed)
    return Buffer.concat([seed, pubkey])
}

const addressFromSeed = (seed: Buffer): string =>
    encodeAddress(new Uint8Array(seedToPublicKey(seed)))

describe('generateMigrationFixtures (tool)', () => {
    test('emits FixtureCrypto.kt', async () => {
        const entropy = Buffer.from(HD_ENTROPY_HEX, 'hex')
        expect(entropy.length).toBe(32)

        const mnemonic = entropyToMnemonic(Uint8Array.from(entropy), wordlist)
        const bip39Seed = await mnemonicToSeed(mnemonic)
        const rootKey = fromSeed(Buffer.from(bip39Seed))
        const xhd = new XHDWalletAPI()

        const hdEntries: Array<{
            label: string
            address: string
            sk64Hex: string
        }> = []
        for (const { account, keyIndex, label } of HD_KEY_INDEXES) {
            const pubkey = await xhd.keyGen(
                rootKey,
                KeyContext.Address,
                account,
                keyIndex,
                BIP32DerivationType.Peikert,
            )
            const address = encodeAddress(pubkey)
            const sk64 = Buffer.concat([
                Buffer.from(pubkey),
                Buffer.from(pubkey),
            ])
            hdEntries.push({
                label,
                address,
                sk64Hex: sk64.toString('hex'),
            })
        }

        const algo25 = (seedHex: string) => {
            const seed = Buffer.from(seedHex, 'hex')
            return {
                seedHex,
                address: addressFromSeed(seed),
                sk64Hex: sk64FromSeed(seed).toString('hex'),
            }
        }

        const algo25Valid = algo25(ALGO25_VALID_SEED_HEX)
        const ledger1 = algo25(LEDGER_1_SEED_HEX)
        const ledger2 = algo25(LEDGER_2_SEED_HEX)
        const watch1 = algo25(WATCH_1_SEED_HEX)
        const watch2 = algo25(WATCH_2_SEED_HEX)
        const externalParticipant = algo25(EXTERNAL_PARTICIPANT_SEED_HEX)

        const fixtureData = {
            generatedAt: new Date().toISOString(),
            hdEntropyHex: HD_ENTROPY_HEX,
            hdEntries,
            algo25Valid,
            ledger1,
            ledger2,
            watch1,
            watch2,
            externalParticipant,
        }

        const kotlin = renderKotlin(fixtureData)
        mkdirSync(resolve(OUTPUT_PATH, '..'), { recursive: true })
        writeFileSync(OUTPUT_PATH, kotlin, 'utf8')

        const swift = renderSwift(fixtureData)
        mkdirSync(resolve(OUTPUT_PATH_SWIFT, '..'), { recursive: true })
        writeFileSync(OUTPUT_PATH_SWIFT, swift, 'utf8')

        for (const addr of [
            ...hdEntries.map(e => e.address),
            algo25Valid.address,
            ledger1.address,
            ledger2.address,
            watch1.address,
            watch2.address,
            externalParticipant.address,
        ]) {
            expect(addr).toMatch(/^[A-Z2-7]{58}$/)
        }
    })
})

const renderKotlin = (data: {
    generatedAt: string
    hdEntropyHex: string
    hdEntries: Array<{ label: string; address: string; sk64Hex: string }>
    algo25Valid: { seedHex: string; address: string; sk64Hex: string }
    ledger1: { seedHex: string; address: string; sk64Hex: string }
    ledger2: { seedHex: string; address: string; sk64Hex: string }
    watch1: { seedHex: string; address: string; sk64Hex: string }
    watch2: { seedHex: string; address: string; sk64Hex: string }
    externalParticipant: { seedHex: string; address: string; sk64Hex: string }
}): string => {
    const hdConsts = data.hdEntries
        .map(
            e =>
                `    const val ${e.label}_ADDRESS = "${e.address}"\n    const val ${e.label}_SK64_HEX = "${e.sk64Hex}"`,
        )
        .join('\n')
    const algo25Block = (
        label: string,
        v: { seedHex: string; address: string; sk64Hex: string },
    ) =>
        `    const val ${label}_ADDRESS = "${v.address}"\n    const val ${label}_SK64_HEX = "${v.sk64Hex}"`
    return `/*
 * Copyright 2022-2025 Pera Wallet, LDA
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */
package com.algorand.perarn.migration.fixtures

internal object FixtureCrypto {
    const val HD_WALLET_ENTROPY_HEX = "${data.hdEntropyHex}"
${hdConsts}

${algo25Block('ALGO25_VALID', data.algo25Valid)}
${algo25Block('LEDGER_1', data.ledger1)}
${algo25Block('LEDGER_2', data.ledger2)}
${algo25Block('WATCH_1', data.watch1)}
${algo25Block('WATCH_2', data.watch2)}
${algo25Block('EXTERNAL_PARTICIPANT', data.externalParticipant)}
}
`
}

const renderSwift = (data: {
    generatedAt: string
    hdEntropyHex: string
    hdEntries: Array<{ label: string; address: string; sk64Hex: string }>
    algo25Valid: { seedHex: string; address: string; sk64Hex: string }
    ledger1: { seedHex: string; address: string; sk64Hex: string }
    ledger2: { seedHex: string; address: string; sk64Hex: string }
    watch1: { seedHex: string; address: string; sk64Hex: string }
    watch2: { seedHex: string; address: string; sk64Hex: string }
    externalParticipant: { seedHex: string; address: string; sk64Hex: string }
}): string => {
    const hdConsts = data.hdEntries
        .map(
            e =>
                `    static let ${e.label}_ADDRESS = "${e.address}"\n    static let ${e.label}_SK64_HEX = "${e.sk64Hex}"`,
        )
        .join('\n')
    const algo25Block = (
        label: string,
        v: { seedHex: string; address: string; sk64Hex: string },
    ) =>
        `    static let ${label}_ADDRESS = "${v.address}"\n    static let ${label}_SK64_HEX = "${v.sk64Hex}"`
    return `/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import Foundation

/// AUTO-GENERATED. Do not edit by hand — re-run the generator instead.
enum FixtureCrypto {
    static let HD_WALLET_ENTROPY_HEX = "${data.hdEntropyHex}"
${hdConsts}

${algo25Block('ALGO25_VALID', data.algo25Valid)}
${algo25Block('LEDGER_1', data.ledger1)}
${algo25Block('LEDGER_2', data.ledger2)}
${algo25Block('WATCH_1', data.watch1)}
${algo25Block('WATCH_2', data.watch2)}
${algo25Block('EXTERNAL_PARTICIPANT', data.externalParticipant)}
}
`
}
