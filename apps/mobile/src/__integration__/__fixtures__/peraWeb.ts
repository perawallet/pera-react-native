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
import { encodeAddress, seedFromMnemonic } from 'algosdk'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'

import { ALGO25_TEST_ADDRESS, ALGO25_TEST_MNEMONIC } from './onboarding'

// A second valid base32 Algorand address. Reused as a "secondary" account
// in multi-account fixtures so we exercise the loop, not just the single
// account path.
export const PERA_WEB_SECONDARY_ADDRESS =
    'CBLWUBRWCWNKZ2Y2Q5HFKN7XISNBVAN47422MZOKH5OGCZ3H5JYLTDPLOA'

// Generate a deterministic 32-byte secretbox key for the test. Order-stable
// so different test cases always agree on what "the right key" means.
export const PERA_WEB_KEY_BYTES = Uint8Array.from(
    Array.from({ length: 32 }, (_, i) => (i * 7 + 13) & 0xff),
)

export const PERA_WEB_BACKUP_ID = 'fixture-backup-id'

// Deterministic 32-byte seed for the "second account" in the multi-account
// fixture. We don't pin a mnemonic — the import path reconstructs one via
// `mnemonicFromSeed`, which round-trips any 32-byte buffer. The address is
// computed at fixture build time.
const SECONDARY_SEED_BYTES = Uint8Array.from(
    Array.from({ length: 32 }, (_, i) => (i * 11 + 5) & 0xff),
)

type FixtureAccount = {
    address: string
    name?: string
    /** 32-byte Algorand seed. Defaults to a deterministic one if omitted. */
    seed: Uint8Array
}

const sealPlaintext = (plaintext: object, key: Uint8Array): string => {
    const nonce = nacl.randomBytes(24)
    // jsdom's TextEncoder returns a Uint8Array from a different realm than
    // tweetnacl's internal Uint8Array; wrap defensively (mirrors the ASB
    // fixture helper). The integration setup aliases `globalThis.Uint8Array`
    // for the runtime, but the explicit wrap keeps the fixture portable.
    const text = Uint8Array.from(
        new TextEncoder().encode(JSON.stringify(plaintext)),
    )
    const box = nacl.secretbox(text, nonce, key)
    const out = new Uint8Array(24 + box.length)
    out.set(nonce, 0)
    out.set(box, 24)
    return encodeToBase64(out)
}

/**
 * Build the `encrypted_content` field that the Pera mobile API would return
 * for a backup row. The format is `base64(nonce(24) || sealed)` — the same
 * shape produced by `Sdk.encrypt` in the Go mobile SDK.
 */
export const buildPeraWebEncryptedContent = ({
    accounts,
    encryptionKey = PERA_WEB_KEY_BYTES,
}: {
    accounts: FixtureAccount[]
    encryptionKey?: Uint8Array
}): string => {
    const payload = accounts.map(a => ({
        address: a.address,
        name: a.name ?? null,
        accountType: 'single',
        privateKey: encodeToBase64(Uint8Array.from(a.seed)),
        metadata: null,
    }))
    return sealPlaintext(payload, encryptionKey)
}

/**
 * Build the JSON string that a user would scan from web.perawallet.app's
 * "Transfer Accounts" QR.
 */
export const buildPeraWebQrString = ({
    backupId = PERA_WEB_BACKUP_ID,
    encryptionKey = PERA_WEB_KEY_BYTES,
    version = '1',
    action = 'import',
    includeOptionalFields = true,
}: {
    backupId?: string
    encryptionKey?: Uint8Array
    version?: string | null
    action?: string | null
    includeOptionalFields?: boolean
} = {}): string => {
    const payload: Record<string, string> = {
        backupId,
        encryptionKey: encodeToBase64(encryptionKey),
    }
    if (includeOptionalFields) {
        if (version !== null) payload.version = version
        if (action !== null) payload.action = action
    }
    return JSON.stringify(payload)
}

/**
 * Build the `perawallet://app/web-import/` app-action URL form of the
 * transfer payload. Same fields as the JSON QR, carried as query params,
 * the key is percent-encoded because base64 can contain `+/=`.
 */
export const buildPeraWebImportUrl = ({
    backupId = PERA_WEB_BACKUP_ID,
    encryptionKey = PERA_WEB_KEY_BYTES,
}: {
    backupId?: string
    encryptionKey?: Uint8Array
} = {}): string =>
    `perawallet://app/web-import/?backupId=${backupId}&encryptionKey=${encodeURIComponent(
        encodeToBase64(encryptionKey),
    )}&action=import`

/** Canonical single-account fixture: the standard Algo25 test mnemonic. */
export const buildSingleAccountPeraWebBackup = (overrides?: {
    name?: string
}): string =>
    buildPeraWebEncryptedContent({
        accounts: [
            {
                address: ALGO25_TEST_ADDRESS,
                name: overrides?.name ?? 'Web Account',
                seed: seedFromMnemonic(ALGO25_TEST_MNEMONIC),
            },
        ],
    })

/**
 * Two-account fixture: the standard Algo25 test account + a secondary one,
 * exercising the import loop. The secondary address is computed at fixture
 * build time from `SECONDARY_TEST_MNEMONIC`.
 */
export const buildMultiAccountPeraWebBackup = () => {
    const secondarySeed = SECONDARY_SEED_BYTES
    const secondaryKeyPair = nacl.sign.keyPair.fromSeed(
        Uint8Array.from(secondarySeed),
    )
    // We derive the secondary address inline so the fixture is independent
    // of any other onboarding fixture's pinned values.
    const secondaryAddress = encodeAddress(secondaryKeyPair.publicKey)

    return {
        encryptedContent: buildPeraWebEncryptedContent({
            accounts: [
                {
                    address: ALGO25_TEST_ADDRESS,
                    name: 'Web Account 1',
                    seed: seedFromMnemonic(ALGO25_TEST_MNEMONIC),
                },
                {
                    address: secondaryAddress,
                    name: 'Web Account 2',
                    seed: secondarySeed,
                },
            ],
        }),
        addresses: [ALGO25_TEST_ADDRESS, secondaryAddress],
    }
}
