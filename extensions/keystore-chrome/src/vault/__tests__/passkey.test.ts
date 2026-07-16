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

import { base64 } from '@scure/base'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createChromeFake, type ChromeFake } from '../../test-utils/chrome'
import {
    isPasskeyUnlockSupported,
    isPasskeyUnlockEnabled,
    enablePasskeyUnlock,
    unlockWithPasskey,
    disablePasskeyUnlock,
} from '../passkey'
import {
    PasskeyUnlockError,
    VaultCorruptedError,
    VaultLockedOutError,
} from '../../errors'
import { getSessionMasterKey } from '../session'
import { createVault, unlockVault, lockVault } from '../vault'
import { InvalidPasswordError } from '../../errors'
import { getLockoutRemainingSeconds, recordFailedAttempt } from '../lockout'

// 32 deterministic bytes used as the fake PRF output.
const FAKE_PRF_BYTES = new Uint8Array(32).fill(0xab)
// Deterministic rawId bytes — distinct from the base64url `id` string to
// ensure we're storing/reading raw bytes, not string-encoded bytes.
const FAKE_RAW_ID = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03])

type WebAuthnMockOptions = {
    /**
     * Poison: PRF results.first returned directly from create() (Chrome
     * 132+ behavior — computed against NO eval salt). The implementation
     * must never derive a KEK from these.
     */
    createPrfResults?: Uint8Array
    /** Computes get()'s prf.results.first from the eval.first salt the caller passed. */
    getPrfResultsForSalt?: (salt: Uint8Array) => Uint8Array
    rawId?: Uint8Array
}

/**
 * Build fake `navigator.credentials.create`/`get` mocks.
 *
 * `create()` asserts its `prf` extension carries NO `eval` input (no salt
 * exists yet at create time) and, if `createPrfResults` is given, returns
 * poisoned create-time PRF results — simulating Chrome 132+, which returns
 * `prf.results` from create() even though it was called with `prf: {}`.
 *
 * `get()` validates `allowCredentials` against the exact raw-byte id of the
 * enrolled credential (not the ASCII bytes of the base64url string) AND
 * asserts `extensions.prf.eval.first` is present, returning
 * `getPrfResultsForSalt(salt)` as the PRF output for that salt.
 */
const installWebAuthnMocks = (
    options: WebAuthnMockOptions = {},
): {
    getMock: ReturnType<typeof vi.fn>
    createMock: ReturnType<typeof vi.fn>
} => {
    const rawId = options.rawId ?? FAKE_RAW_ID
    const getPrfResultsForSalt =
        options.getPrfResultsForSalt ?? (() => FAKE_PRF_BYTES)

    const makeCredential = (prfResults: { first: ArrayBuffer } | null) => ({
        id: 'ZGVhZGJlZWYwMTAyMDM', // base64url of FAKE_RAW_ID — intentionally different bytes than rawId
        rawId: rawId.buffer as ArrayBuffer,
        type: 'public-key' as const,
        getClientExtensionResults: () => ({
            prf: prfResults
                ? { enabled: true, results: prfResults }
                : { enabled: true },
        }),
        response: {} as AuthenticatorResponse,
        authenticatorAttachment: null,
    })

    const createMock = vi.fn(
        async (
            createOptions?: CredentialCreationOptions,
        ): Promise<Credential | null> => {
            const prfExt = createOptions?.publicKey?.extensions as
                | AuthenticationExtensionsClientInputs
                | undefined
            if (prfExt?.prf && 'eval' in prfExt.prf) {
                throw new Error(
                    'create() must not pass prf.eval — no salt exists at create time',
                )
            }
            const createResults = options.createPrfResults
                ? { first: options.createPrfResults.buffer as ArrayBuffer }
                : null
            return makeCredential(createResults)
        },
    )

    // get() validates that allowCredentials contains the raw id bytes and
    // that a PRF eval salt was provided.
    const getMock = vi.fn(
        async (
            requestOptions?: CredentialRequestOptions,
        ): Promise<Credential | null> => {
            const allowed = requestOptions?.publicKey?.allowCredentials ?? []
            const providedId =
                allowed.length > 0
                    ? new Uint8Array(allowed[0].id as ArrayBuffer)
                    : null

            // If a credential id was provided, verify it matches rawId bytes.
            if (providedId !== null) {
                const match =
                    providedId.length === rawId.length &&
                    providedId.every((b, i) => b === rawId[i])
                if (!match) {
                    throw new DOMException(
                        'No credentials available for the specified credential id.',
                        'NotAllowedError',
                    )
                }
            }

            const prfExt = requestOptions?.publicKey?.extensions as
                | AuthenticationExtensionsClientInputs
                | undefined
            const saltBuffer = prfExt?.prf?.eval?.first
            if (!saltBuffer) {
                throw new Error(
                    'get() must pass prf.eval.first — the persisted salt',
                )
            }
            const salt = new Uint8Array(saltBuffer as ArrayBuffer)
            const prfBytes = getPrfResultsForSalt(salt)

            return makeCredential({
                first: prfBytes.buffer as ArrayBuffer,
            })
        },
    )

    const credsMock = {
        create: createMock,
        get: getMock,
    } as unknown as CredentialsContainer

    Object.defineProperty(globalThis, 'navigator', {
        value: { credentials: credsMock },
        configurable: true,
        writable: true,
    })

    // Also install a minimal PublicKeyCredential so feature-detect returns true.
    if (!('PublicKeyCredential' in globalThis)) {
        Object.defineProperty(globalThis, 'PublicKeyCredential', {
            value: class {},
            configurable: true,
            writable: true,
        })
    }

    return { getMock, createMock }
}

/**
 * Build a fake credential whose `get()` mock validates that
 * `allowCredentials` was called with the exact raw-byte id of the enrolled
 * credential (not the ASCII bytes of the base64url string).
 *
 * `getMock` is exposed so tests can inspect call args.
 */
const installCredentialsMock = (
    prfOutput: Uint8Array = FAKE_PRF_BYTES,
    rawId: Uint8Array = FAKE_RAW_ID,
): { getMock: ReturnType<typeof vi.fn> } =>
    installWebAuthnMocks({ getPrfResultsForSalt: () => prfOutput, rawId })

describe('passkey vault', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
        installCredentialsMock()
    })

    describe('isPasskeyUnlockSupported', () => {
        it('returns true when PublicKeyCredential exists', async () => {
            expect(await isPasskeyUnlockSupported()).toBe(true)
        })

        it('returns false when PublicKeyCredential is undefined', async () => {
            Object.defineProperty(globalThis, 'PublicKeyCredential', {
                value: undefined,
                configurable: true,
                writable: true,
            })
            expect(await isPasskeyUnlockSupported()).toBe(false)
            // Restore for subsequent tests.
            Object.defineProperty(globalThis, 'PublicKeyCredential', {
                value: class {},
                configurable: true,
                writable: true,
            })
        })

        describe('capability API (getClientCapabilities)', () => {
            // WebAuthn L3 namespaces extension capabilities under
            // 'extension:prf' (Chromium 133+, verified empirically in
            // Chromium 149). Installs a PublicKeyCredential stub whose
            // getClientCapabilities resolves the given map.
            const withCapabilities = (caps: Record<string, boolean>): void => {
                Object.defineProperty(globalThis, 'PublicKeyCredential', {
                    value: class {
                        static getClientCapabilities = vi
                            .fn()
                            .mockResolvedValue(caps)
                    },
                    configurable: true,
                    writable: true,
                })
            }

            afterEach(() => {
                Object.defineProperty(globalThis, 'PublicKeyCredential', {
                    value: class {},
                    configurable: true,
                    writable: true,
                })
            })

            it('returns true when extension:prf is true', async () => {
                withCapabilities({ 'extension:prf': true })
                expect(await isPasskeyUnlockSupported()).toBe(true)
            })

            it('returns false when extension:prf is false', async () => {
                withCapabilities({ 'extension:prf': false })
                expect(await isPasskeyUnlockSupported()).toBe(false)
            })

            it('treats an absent extension:prf key as unknown and stays optimistic', async () => {
                withCapabilities({})
                expect(await isPasskeyUnlockSupported()).toBe(true)
            })

            it('falls back to the legacy prf key when extension:prf is absent', async () => {
                withCapabilities({ prf: false })
                expect(await isPasskeyUnlockSupported()).toBe(false)
            })

            it('falls back to the legacy prf key returning true when extension:prf is absent', async () => {
                withCapabilities({ prf: true })
                expect(await isPasskeyUnlockSupported()).toBe(true)
            })
        })
    })

    describe('isPasskeyUnlockEnabled', () => {
        it('returns false before enablePasskeyUnlock is called', async () => {
            expect(await isPasskeyUnlockEnabled()).toBe(false)
        })

        it('returns true after enablePasskeyUnlock succeeds', async () => {
            await createVault('test-password')
            await enablePasskeyUnlock('test-password')
            expect(await isPasskeyUnlockEnabled()).toBe(true)
        })
    })

    describe('enablePasskeyUnlock', () => {
        it('throws InvalidPasswordError and writes no blob on wrong password', async () => {
            await createVault('correct-password')
            await expect(
                enablePasskeyUnlock('wrong-password'),
            ).rejects.toBeInstanceOf(InvalidPasswordError)
            expect(await isPasskeyUnlockEnabled()).toBe(false)
        })

        it('writes a valid PRF blob on correct password', async () => {
            await createVault('correct-password')
            await enablePasskeyUnlock('correct-password')
            const raw = fake.data.get('vault:wrapped-master-key-prf')
            expect(typeof raw).toBe('string')
            const blob = JSON.parse(String(raw))
            expect(blob.version).toBe(1)
            expect(blob.kdf).toBe('HKDF-SHA256-PRF')
            expect(typeof blob.hkdfSalt).toBe('string')
            expect(typeof blob.iv).toBe('string')
            expect(typeof blob.ciphertext).toBe('string')
            expect(typeof blob.prfEvalSalt).toBe('string')
        })

        it('stores the credential raw id bytes (base64-encoded), not the base64url string', async () => {
            await createVault('correct-password')
            await enablePasskeyUnlock('correct-password')
            const storedEncoded = fake.data.get('vault:prf-credential-id')
            expect(typeof storedEncoded).toBe('string')
            // Decode and verify it matches FAKE_RAW_ID bytes (not ASCII of the id string).
            const decoded = base64.decode(String(storedEncoded))
            expect(decoded).toEqual(FAKE_RAW_ID)
        })
    })

    describe('unlockWithPasskey', () => {
        it('enable → lock → unlockWithPasskey restores the same session master key as password unlock', async () => {
            await createVault('test-password')
            const masterKeyAfterCreate = await getSessionMasterKey()
            await enablePasskeyUnlock('test-password')
            await lockVault()
            expect(await getSessionMasterKey()).toBeNull()

            await unlockWithPasskey()
            const masterKeyAfterPasskey = await getSessionMasterKey()
            expect(masterKeyAfterPasskey).toEqual(masterKeyAfterCreate)
        })

        it('passes raw credential id bytes (not string-encoded) in allowCredentials', async () => {
            const { getMock } = installCredentialsMock()
            await createVault('test-password')
            await enablePasskeyUnlock('test-password')
            await lockVault()

            await unlockWithPasskey()

            expect(getMock).toHaveBeenCalled()
            const callArgs = getMock.mock.calls[getMock.mock.calls.length - 1]
            const options = callArgs[0] as CredentialRequestOptions
            const id = new Uint8Array(
                options.publicKey!.allowCredentials![0].id as ArrayBuffer,
            )
            // Must match rawId bytes, not ASCII of the 'id' string.
            expect(id).toEqual(FAKE_RAW_ID)
        })

        it('throws PasskeyUnlockError (not generic Error) when PRF output is tampered', async () => {
            await createVault('test-password')
            await enablePasskeyUnlock('test-password')
            await lockVault()

            // Different PRF bytes → wrong KEK → AES-GCM auth tag failure.
            const tamperedBytes = new Uint8Array(32).fill(0xcd)
            installCredentialsMock(tamperedBytes)

            await expect(unlockWithPasskey()).rejects.toBeInstanceOf(
                PasskeyUnlockError,
            )
            expect(await getSessionMasterKey()).toBeNull()
        })

        it('never derives the KEK from create-time PRF results (eval-salt mismatch)', async () => {
            // create() returns PRF results NOT computed against prfEvalSalt
            // (create was called with prf:{} — no eval input). Deriving from
            // them bricks the blob. The implementation must ignore them and
            // use the follow-up assertion, which evaluates against the
            // persisted salt.
            const poisonBytes = new Uint8Array(32).fill(0xff)
            const deterministicPrf = (salt: Uint8Array): Uint8Array => salt
            installWebAuthnMocks({
                createPrfResults: poisonBytes,
                getPrfResultsForSalt: salt => deterministicPrf(salt),
            })

            await createVault('test-password')
            await enablePasskeyUnlock('test-password')
            await lockVault()
            await unlockWithPasskey()
            expect(await getSessionMasterKey()).not.toBeNull()
        })

        it('throws VaultLockedOutError without invoking WebAuthn when locked out', async () => {
            await createVault('test-password')
            await enablePasskeyUnlock('test-password')
            await lockVault()

            const { getMock } = installCredentialsMock()
            for (let i = 0; i < 5; i++) await recordFailedAttempt()

            await expect(unlockWithPasskey()).rejects.toBeInstanceOf(
                VaultLockedOutError,
            )
            expect(getMock).not.toHaveBeenCalled()
            expect(await getSessionMasterKey()).toBeNull()
        })

        it('clears the failed-attempt counter on successful passkey unlock', async () => {
            await createVault('test-password')
            await enablePasskeyUnlock('test-password')
            await lockVault()

            // Not enough failures to trigger a lockout, but the counter is nonzero.
            await recordFailedAttempt()
            await recordFailedAttempt()

            await unlockWithPasskey()

            expect(await getLockoutRemainingSeconds()).toBe(0)
            // Confirm the counter itself was reset, not just that no lockout
            // is currently active — five MORE failures would otherwise still
            // trigger a lockout with 2 stale failures baked in.
            await lockVault()
            for (let i = 0; i < 4; i++) await recordFailedAttempt()
            expect(await getLockoutRemainingSeconds()).toBe(0)
        })

        it('propagates NotAllowedError (user cancel) without suppressing', async () => {
            await createVault('test-password')
            await enablePasskeyUnlock('test-password')
            await lockVault()

            // Simulate wrong raw id → get() throws NotAllowedError.
            // (The validator inside installCredentialsMock does this automatically
            // when the stored bytes don't match; here we simulate it directly.)
            Object.defineProperty(globalThis, 'navigator', {
                value: {
                    credentials: {
                        create: vi.fn(),
                        get: vi
                            .fn()
                            .mockRejectedValue(
                                new DOMException(
                                    'User cancelled',
                                    'NotAllowedError',
                                ),
                            ),
                    },
                },
                configurable: true,
                writable: true,
            })

            await expect(unlockWithPasskey()).rejects.toThrow(DOMException)
            expect(await getSessionMasterKey()).toBeNull()
        })
    })

    describe('unlockWithPasskey blob validation', () => {
        it('rejects a stored PRF blob whose hkdfSalt decodes to the wrong byte length', async () => {
            await createVault('test-password')
            await enablePasskeyUnlock('test-password')
            await lockVault()
            const blob = JSON.parse(
                String(fake.data.get('vault:wrapped-master-key-prf')),
            )
            blob.hkdfSalt = base64.encode(new Uint8Array(3)) // enable path writes 16 bytes
            fake.data.set('vault:wrapped-master-key-prf', JSON.stringify(blob))
            await expect(unlockWithPasskey()).rejects.toBeInstanceOf(
                VaultCorruptedError,
            )
        })

        it('rejects a stored PRF blob whose iv decodes to the wrong byte length', async () => {
            await createVault('test-password')
            await enablePasskeyUnlock('test-password')
            await lockVault()
            const blob = JSON.parse(
                String(fake.data.get('vault:wrapped-master-key-prf')),
            )
            blob.iv = base64.encode(new Uint8Array(4)) // enable path writes 12 bytes
            fake.data.set('vault:wrapped-master-key-prf', JSON.stringify(blob))
            await expect(unlockWithPasskey()).rejects.toBeInstanceOf(
                VaultCorruptedError,
            )
        })

        it('rejects a stored PRF blob whose prfEvalSalt decodes to the wrong byte length', async () => {
            await createVault('test-password')
            await enablePasskeyUnlock('test-password')
            await lockVault()
            const blob = JSON.parse(
                String(fake.data.get('vault:wrapped-master-key-prf')),
            )
            blob.prfEvalSalt = base64.encode(new Uint8Array(8)) // enable path writes 32 bytes
            fake.data.set('vault:wrapped-master-key-prf', JSON.stringify(blob))
            await expect(unlockWithPasskey()).rejects.toBeInstanceOf(
                VaultCorruptedError,
            )
        })
    })

    describe('disablePasskeyUnlock', () => {
        it('removes both storage keys and flips isPasskeyUnlockEnabled to false', async () => {
            await createVault('test-password')
            await enablePasskeyUnlock('test-password')
            expect(await isPasskeyUnlockEnabled()).toBe(true)

            await disablePasskeyUnlock()

            expect(await isPasskeyUnlockEnabled()).toBe(false)
            expect(fake.data.has('vault:wrapped-master-key-prf')).toBe(false)
            expect(fake.data.has('vault:prf-credential-id')).toBe(false)
        })
    })

    describe('unlockVault (password unlock) still works after passkey is enabled', () => {
        it('password unlock co-exists with passkey unlock', async () => {
            await createVault('test-password')
            const masterKey = await getSessionMasterKey()
            await enablePasskeyUnlock('test-password')
            await lockVault()
            await unlockVault('test-password')
            expect(await getSessionMasterKey()).toEqual(masterKey)
        })
    })

    describe('createVault clears stale PRF blob', () => {
        it('re-creating the vault removes any previously enrolled passkey blob', async () => {
            // Enable passkey on first vault.
            await createVault('first-password')
            await enablePasskeyUnlock('first-password')
            expect(await isPasskeyUnlockEnabled()).toBe(true)

            // Lock and destroy the first vault by removing the wrapped key
            // so a second createVault is allowed (circumvents VaultExistsError).
            await lockVault()
            fake.data.delete('vault:wrapped-master-key')

            // Create a new vault with a different password.
            await createVault('second-password')

            // The PRF blob for the old master key must have been removed.
            expect(await isPasskeyUnlockEnabled()).toBe(false)
            expect(fake.data.has('vault:prf-credential-id')).toBe(false)
        })
    })
})
