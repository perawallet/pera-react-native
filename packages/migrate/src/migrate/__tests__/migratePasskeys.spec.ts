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

import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
    keystoreState,
    accountsState,
    loggerMock,
    deriveMainKeyMock,
    deriveCredentialMock,
    entryExistsMock,
    writeEntryMock,
    disposeMock,
    entropyToMnemonicMock,
    platformMock,
} = vi.hoisted(() => ({
    keystoreState: { keys: [] as Array<Record<string, unknown>> },
    accountsState: { accounts: [] as Array<Record<string, unknown>> },
    loggerMock: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
    deriveMainKeyMock: vi.fn(),
    deriveCredentialMock: vi.fn(),
    entryExistsMock: vi.fn(),
    writeEntryMock: vi.fn(),
    disposeMock: vi.fn(),
    entropyToMnemonicMock: vi.fn(),
    platformMock: { OS: 'android' as 'android' | 'ios' },
}))

vi.mock('react-native', () => ({ Platform: platformMock }))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore: () => ({ state: keystoreState }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: { getState: () => accountsState },
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    entropyToMnemonic: entropyToMnemonicMock,
    entropyKeyId: (seedKeyId: string) => `${seedKeyId}-bip39-entropy`,
    // Models the entropy secret-key: resolves the mnemonic only when the seed
    // has its `${seedId}-bip39-entropy` entry in the keystore.
    withSecret: async (id: string, handler: (bytes: Uint8Array) => unknown) =>
        keystoreState.keys.some(k => k.id === id)
            ? handler(Uint8Array.from([0xaa, 0xbb, 0xcc]))
            : null,
    zeroBytes: (...buffers: Array<Uint8Array | null | undefined>) => {
        for (const buf of buffers) if (buf) buf.fill(0)
    },
}))

// Real encoding helpers (the pure deriveLegacyPasskeyCredential module, loaded
// via importActual below, depends on them); only the logger is a spy.
vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: loggerMock,
    encodeToBase64: (bytes: Uint8Array) =>
        Buffer.from(bytes).toString('base64'),
    decodeFromBase64: (value: string) =>
        Uint8Array.from(Buffer.from(value, 'base64')),
    hexToBytes: (hex: string) => Uint8Array.from(Buffer.from(hex, 'hex')),
    bytesToHex: (bytes: Uint8Array) => Buffer.from(bytes).toString('hex'),
    bytesEqual: (a?: Uint8Array, b?: Uint8Array) =>
        a != null &&
        b != null &&
        a.length === b.length &&
        a.every((v, i) => v === b[i]),
}))

// Keep the real pure helpers (decode / standard-base64) so the orchestrator's
// credentialId handling is exercised for real; only the heavy derivation entry
// points are stubbed.
vi.mock('../passkeys/deriveLegacyPasskeyCredential', async importActual => ({
    ...(await importActual<
        typeof import('../passkeys/deriveLegacyPasskeyCredential')
    >()),
    deriveMainKey: deriveMainKeyMock,
    deriveLegacyPasskeyCredentialFromMainKey: deriveCredentialMock,
}))

// Fully mocked — the real module imports react-native-keystore (native MMKV).
// createNativePasskeyWriter returns the per-write spy (with a dispose spy
// attached) so the batch shares one writer.
vi.mock('../passkeys/writeNativePasskeyEntry', () => ({
    nativePasskeyEntryExists: entryExistsMock,
    createNativePasskeyWriter: () =>
        Object.assign(writeEntryMock, { dispose: disposeMock }),
}))

import type { LegacyPasskey } from '@perawallet/wallet-extension-platform'
import { migratePasskeys } from '../migratePasskeys'

const SEED_ID = 'seed-1'
const DERIVED_KEY_ID = 'derived-1'
const ADDRESS = 'ADDR_A'

// A 32-byte SHA256-shaped digest and its standard-base64 form (the credentialId).
const ID_BYTES = new Uint8Array(32)
for (let i = 0; i < 32; i += 1) ID_BYTES[i] = (i * 5 + 3) & 0xff
const CRED_ID_B64 = Buffer.from(ID_BYTES).toString('base64')

const buildPasskey = (overrides: Partial<LegacyPasskey> = {}): LegacyPasskey =>
    ({
        credentialId: CRED_ID_B64,
        address: ADDRESS,
        siteUrl: 'webauthn.io',
        siteName: null,
        userName: 'qwe',
        userDisplayName: 'qwe display',
        userHandle: 'dXNlci1pZA',
        lastUsedAtMs: 1_700_000_000_000,
        ...overrides,
    }) as LegacyPasskey

const derivedFor = (idBytes: Uint8Array) => ({
    credentialId: Buffer.from(idBytes).toString('base64'),
    credentialIdBytes: idBytes,
    privateKey: new Uint8Array(32).fill(1),
    publicKeySpkiDer: new Uint8Array(91).fill(2),
})

beforeEach(() => {
    platformMock.OS = 'android'
    loggerMock.warn.mockReset()
    loggerMock.error.mockReset()
    deriveMainKeyMock.mockReset().mockResolvedValue(new Uint8Array(64))
    deriveCredentialMock.mockReset().mockResolvedValue(derivedFor(ID_BYTES))
    entryExistsMock.mockReset().mockReturnValue(false)
    writeEntryMock.mockReset().mockResolvedValue(undefined)
    disposeMock.mockReset()
    entropyToMnemonicMock.mockReset().mockReturnValue('test mnemonic phrase')

    accountsState.accounts = [{ address: ADDRESS, keyPairId: DERIVED_KEY_ID }]
    keystoreState.keys = [
        { id: SEED_ID, type: 'seed', metadata: { scheme: 'bip39' } },
        {
            id: `${SEED_ID}-bip39-entropy`,
            type: 'secret-key',
            metadata: { parentKeyId: SEED_ID },
        },
        {
            id: DERIVED_KEY_ID,
            type: 'hd-derived-ed25519',
            metadata: { parentKeyId: SEED_ID },
        },
    ]
})

describe('migratePasskeys', () => {
    it('writes a native credential when the derived id matches the legacy id', async () => {
        const result = await migratePasskeys([buildPasskey()])

        expect(result).toEqual({ imported: 1, skipped: 0 })
        // dp256 derives against the full WebAuthn origin, not the bare host.
        expect(deriveCredentialMock).toHaveBeenCalledWith(
            expect.objectContaining({
                origin: 'https://webauthn.io',
                userName: 'qwe',
            }),
        )
        // user.id ('dXNlci1pZA') goes into userId; the display name into
        // userName/displayName. userHandle is no longer the user.name.
        expect(writeEntryMock).toHaveBeenCalledWith(
            expect.objectContaining({
                credentialId: CRED_ID_B64,
                origin: 'https://webauthn.io',
                userId: 'dXNlci1pZA',
                userName: 'qwe',
                displayName: 'qwe display',
                lastUsedAtMs: 1_700_000_000_000,
            }),
        )
    })

    it('zeroes the derived private key once the credential is written', async () => {
        const derived = derivedFor(ID_BYTES)
        deriveCredentialMock.mockResolvedValueOnce(derived)

        await migratePasskeys([buildPasskey()])

        expect(derived.privateKey.every(byte => byte === 0)).toBe(true)
    })

    it('zeroes the derived private key even when the credentialId mismatches (skip path)', async () => {
        // Derived id differs from the legacy id → the gate fails and the passkey
        // is skipped, but the freshly-derived private key must still be wiped.
        const derived = derivedFor(new Uint8Array(32).fill(0xaa))
        deriveCredentialMock.mockResolvedValueOnce(derived)

        const result = await migratePasskeys([buildPasskey()])

        expect(result).toEqual({ imported: 0, skipped: 1 })
        expect(writeEntryMock).not.toHaveBeenCalled()
        expect(derived.privateKey.every(byte => byte === 0)).toBe(true)
    })

    it('disposes the writer (wiping the master key) after the batch', async () => {
        await migratePasskeys([buildPasskey()])

        expect(disposeMock).toHaveBeenCalledTimes(1)
    })

    it('zeroes the cached derived main key after the batch', async () => {
        const mainKey = new Uint8Array(64).fill(9)
        deriveMainKeyMock.mockResolvedValueOnce(mainKey)

        await migratePasskeys([buildPasskey()])

        expect(mainKey.every(byte => byte === 0)).toBe(true)
    })

    it('disposes the writer even when a write throws', async () => {
        writeEntryMock.mockRejectedValueOnce(new Error('mmkv write failed'))

        const result = await migratePasskeys([buildPasskey()])

        expect(result).toEqual({ imported: 0, skipped: 1 })
        expect(disposeMock).toHaveBeenCalledTimes(1)
    })

    it('does not double-prefix a siteUrl that already has a scheme', async () => {
        await migratePasskeys([
            buildPasskey({ siteUrl: 'https://webauthn.io' }),
        ])

        expect(deriveCredentialMock).toHaveBeenCalledWith(
            expect.objectContaining({ origin: 'https://webauthn.io' }),
        )
    })

    it('Android: derives with the https origin and the spki-der id basis', async () => {
        await migratePasskeys([buildPasskey({ siteUrl: 'webauthn.io' })])

        expect(deriveCredentialMock).toHaveBeenCalledWith(
            expect.objectContaining({
                origin: 'https://webauthn.io',
                credentialIdBasis: 'spki-der',
            }),
        )
    })

    it('iOS: derives with the verbatim origin and the raw-point id basis', async () => {
        platformMock.OS = 'ios'

        await migratePasskeys([buildPasskey({ siteUrl: 'webauthn.io' })])

        expect(deriveCredentialMock).toHaveBeenCalledWith(
            expect.objectContaining({
                origin: 'webauthn.io',
                userName: 'qwe',
                credentialIdBasis: 'raw-point',
            }),
        )
    })

    it('returns zero and writes nothing for an empty list', async () => {
        const result = await migratePasskeys([])

        expect(result).toEqual({ imported: 0, skipped: 0 })
        expect(writeEntryMock).not.toHaveBeenCalled()
    })

    it('skips (without deriving) a credential already in the keystore', async () => {
        entryExistsMock.mockReturnValue(true)

        const result = await migratePasskeys([buildPasskey()])

        expect(result).toEqual({ imported: 0, skipped: 1 })
        expect(deriveCredentialMock).not.toHaveBeenCalled()
        expect(writeEntryMock).not.toHaveBeenCalled()
    })

    it('skips a passkey missing the userName derivation input', async () => {
        const result = await migratePasskeys([buildPasskey({ userName: null })])

        expect(result).toEqual({ imported: 0, skipped: 1 })
        expect(writeEntryMock).not.toHaveBeenCalled()
    })

    it('skips a passkey with an unreadable credentialId', async () => {
        const result = await migratePasskeys([
            buildPasskey({ credentialId: 'not-a-32-byte-id' }),
        ])

        expect(result).toEqual({ imported: 0, skipped: 1 })
        expect(writeEntryMock).not.toHaveBeenCalled()
        expect(loggerMock.warn).toHaveBeenCalled()
    })

    it('skips (without deriving) a passkey whose account did not migrate', async () => {
        const result = await migratePasskeys([
            buildPasskey({ address: 'UNKNOWN_ADDR' }),
        ])

        expect(result).toEqual({ imported: 0, skipped: 1 })
        expect(deriveCredentialMock).not.toHaveBeenCalled()
        expect(writeEntryMock).not.toHaveBeenCalled()
        expect(loggerMock.warn).toHaveBeenCalledWith(
            expect.stringContaining('account not migrated'),
            expect.objectContaining({ address: 'UNKNOWN_ADDR' }),
        )
    })

    it('skips a passkey whose migrated account has no resolvable HD seed', async () => {
        keystoreState.keys = [
            { id: DERIVED_KEY_ID, type: 'private-key', metadata: {} },
        ]

        const result = await migratePasskeys([buildPasskey()])

        expect(result).toEqual({ imported: 0, skipped: 1 })
        expect(deriveCredentialMock).not.toHaveBeenCalled()
        expect(writeEntryMock).not.toHaveBeenCalled()
        expect(loggerMock.warn).toHaveBeenCalledWith(
            expect.stringContaining('unresolved HD seed'),
            expect.anything(),
        )
    })

    it('skips a passkey whose seed has no BIP39 entropy', async () => {
        keystoreState.keys = [
            { id: SEED_ID, type: 'seed', metadata: {} },
            {
                id: DERIVED_KEY_ID,
                type: 'hd-derived-ed25519',
                metadata: { parentKeyId: SEED_ID },
            },
        ]

        const result = await migratePasskeys([buildPasskey()])

        expect(result).toEqual({ imported: 0, skipped: 1 })
        expect(deriveCredentialMock).not.toHaveBeenCalled()
        expect(writeEntryMock).not.toHaveBeenCalled()
        expect(loggerMock.warn).toHaveBeenCalled()
    })

    it('skips (does not persist) when the derived id does not match the legacy id', async () => {
        deriveCredentialMock.mockResolvedValue(
            derivedFor(new Uint8Array(32).fill(0xff)),
        )

        const result = await migratePasskeys([buildPasskey()])

        expect(result).toEqual({ imported: 0, skipped: 1 })
        expect(writeEntryMock).not.toHaveBeenCalled()
        expect(loggerMock.warn).toHaveBeenCalled()
    })

    it('does not write the same credential twice within one batch', async () => {
        const result = await migratePasskeys([buildPasskey(), buildPasskey()])

        expect(result).toEqual({ imported: 1, skipped: 1 })
        expect(writeEntryMock).toHaveBeenCalledTimes(1)
    })

    it('derives the main key once per seed across multiple passkeys', async () => {
        // Two passkeys on the same seed but different sites → two distinct ids,
        // both must verify, so we echo the requested origin into the id bytes.
        const idA = new Uint8Array(32).fill(0x10)
        const idB = new Uint8Array(32).fill(0x20)
        deriveCredentialMock.mockImplementation(async ({ origin }) =>
            derivedFor(origin === 'https://a.example' ? idA : idB),
        )

        const result = await migratePasskeys([
            buildPasskey({
                siteUrl: 'a.example',
                credentialId: Buffer.from(idA).toString('base64'),
            }),
            buildPasskey({
                siteUrl: 'b.example',
                credentialId: Buffer.from(idB).toString('base64'),
            }),
        ])

        expect(result).toEqual({ imported: 2, skipped: 0 })
        expect(deriveMainKeyMock).toHaveBeenCalledTimes(1)
        expect(deriveCredentialMock).toHaveBeenCalledTimes(2)
    })

    it('counts a failed write as skipped without breaking the batch', async () => {
        const idB = new Uint8Array(32).fill(0x20)
        deriveCredentialMock.mockImplementation(async ({ origin }) =>
            derivedFor(origin === 'https://fail.example' ? ID_BYTES : idB),
        )
        writeEntryMock
            .mockRejectedValueOnce(new Error('mmkv busy'))
            .mockResolvedValueOnce(undefined)

        const result = await migratePasskeys([
            buildPasskey({
                siteUrl: 'fail.example',
                credentialId: CRED_ID_B64,
            }),
            buildPasskey({
                siteUrl: 'ok.example',
                credentialId: Buffer.from(idB).toString('base64'),
            }),
        ])

        expect(result).toEqual({ imported: 1, skipped: 1 })
        expect(loggerMock.error).toHaveBeenCalled()
    })

    it('passes an empty userId and warns when the legacy passkey has no user.id', async () => {
        await migratePasskeys([buildPasskey({ userHandle: null })])

        expect(writeEntryMock).toHaveBeenCalledWith(
            expect.objectContaining({ userId: '' }),
        )
        expect(loggerMock.warn).toHaveBeenCalledWith(
            expect.stringContaining('no WebAuthn user.id'),
            expect.objectContaining({ credentialId: CRED_ID_B64 }),
        )
    })
})
