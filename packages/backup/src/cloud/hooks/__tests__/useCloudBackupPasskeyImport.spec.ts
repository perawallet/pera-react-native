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

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { webcrypto } from 'node:crypto'
import {
    derivePasskeyCredential,
    derivePasskeyMainKey,
    type DerivedPasskeyCredential,
} from '@perawallet/wallet-core-passkeys'
import {
    useCloudBackupPasskeyImport,
    type ResolvedSeed,
} from '../useCloudBackupPasskeyImport'

const subtle = webcrypto.subtle as unknown as SubtleCrypto
const ENTROPY = new Uint8Array(32).fill(7)

const writeEntry = vi.fn()
const refreshIdentities = vi.fn().mockResolvedValue(undefined)
const entryExists = vi.fn().mockReturnValue(false)
// A fresh copy per call, like the real resolver: the import zeroes what it is
// handed, so a shared buffer would be blanked for every later test.
const resolveEntropy = vi.fn(async (seedAddress: string) =>
    seedAddress === 'SEEDADDRESS'
        ? { seedKeyId: 'local-seed-id', entropy: new Uint8Array(ENTROPY) }
        : null,
)

vi.mock('@perawallet/wallet-core-passkeys', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-passkeys')
        >()
    return {
        ...actual,
        // Spied, not replaced, so a test can inspect the real key material.
        derivePasskeyCredential: vi.fn(actual.derivePasskeyCredential),
        derivePasskeyMainKey: vi.fn(actual.derivePasskeyMainKey),
        writeNativePasskeyEntry: (...args: unknown[]) => writeEntry(...args),
        nativePasskeyEntryExists: (...args: unknown[]) => entryExists(...args),
        usePasskeyAutofillService: () => ({
            refreshCredentialIdentities: refreshIdentities,
        }),
    }
})

// The credentials derived since the spy was last cleared.
const derivedSinceClear = (): Promise<DerivedPasskeyCredential[]> =>
    Promise.all(
        vi.mocked(derivePasskeyCredential).mock.results.map(r => r.value),
    )

const toBase64 = (bytes: Uint8Array): string =>
    Buffer.from(bytes).toString('base64')

const deriveFromSeed = async (identity: string, counter: number) =>
    derivePasskeyCredential({
        mainKey: await derivePasskeyMainKey(ENTROPY, subtle),
        origin: 'webauthn.io',
        identity,
        counter,
    })

const buildPayload = async (
    overrides: { identity?: string; counter?: number } & Record<
        string,
        unknown
    > = {},
) => {
    const identity = overrides.identity ?? 'alice'
    const counter = overrides.counter ?? 0
    // Derived with the same counter the payload carries, or the public key
    // would not match and every such payload would skip.
    const derived = await deriveFromSeed(identity, counter)
    return {
        credentialId: derived.credentialId,
        origin: 'webauthn.io',
        identity,
        counter,
        publicKeySpkiDer: toBase64(derived.publicKeySpkiDer),
        seedAddress: 'SEEDADDRESS',
        userId: 'dXNlcg==',
        userName: 'alice',
        displayName: 'Alice',
        createdAt: 1,
        ...overrides,
    }
}

/** A credential as a build that backs up its key writes it: no derivation
 *  inputs, so only the secret can restore it. */
const buildPulledWithSecret = async (identity = 'carol') => {
    const derived = await deriveFromSeed(identity, 0)
    return {
        payload: {
            credentialId: derived.credentialId,
            origin: 'webauthn.io',
            publicKeySpkiDer: toBase64(derived.publicKeySpkiDer),
            userId: 'dXNlcg==',
            createdAt: 1,
        },
        secret: {
            credentialId: derived.credentialId,
            privateKey: toBase64(derived.privateKey),
        },
    }
}

const withoutSecret = async (
    overrides: Parameters<typeof buildPayload>[0] = {},
) => ({ payload: await buildPayload(overrides), secret: null })

describe('useCloudBackupPasskeyImport', () => {
    beforeEach(() => {
        writeEntry.mockReset()
        refreshIdentities.mockReset().mockResolvedValue(undefined)
        entryExists.mockReturnValue(false)
        resolveEntropy.mockClear()
    })

    describe('with a backed-up private key', () => {
        it('writes the credential without its wallet being on this device', async () => {
            const pulled = await buildPulledWithSecret()
            const { result } = renderHook(() =>
                useCloudBackupPasskeyImport(resolveEntropy),
            )

            const summary = await result.current.importPasskeys([pulled])

            expect(summary.imported).toBe(1)
            expect(resolveEntropy).not.toHaveBeenCalled()
            expect(writeEntry).toHaveBeenCalledWith(
                expect.objectContaining({
                    credentialId: pulled.payload.credentialId,
                    parentKeyId: undefined,
                    createdAtMs: pulled.payload.createdAt,
                }),
            )
        })

        it('prefers the secret over a seed it could re-derive from', async () => {
            const pulled = {
                payload: await buildPayload(),
                secret: (await buildPulledWithSecret('alice')).secret,
            }
            const { result } = renderHook(() =>
                useCloudBackupPasskeyImport(resolveEntropy),
            )

            const summary = await result.current.importPasskeys([pulled])

            expect(summary.imported).toBe(1)
            expect(resolveEntropy).not.toHaveBeenCalled()
        })

        it('skips and never writes when the key does not produce the backed-up public key', async () => {
            const pulled = await buildPulledWithSecret()
            const other = await buildPulledWithSecret('mallory')
            const { result } = renderHook(() =>
                useCloudBackupPasskeyImport(resolveEntropy),
            )

            const summary = await result.current.importPasskeys([
                { ...pulled, secret: other.secret },
            ])

            expect(summary.skipped).toEqual([
                {
                    credentialId: pulled.payload.credentialId,
                    reason: 'pubkey-mismatch',
                },
            ])
            expect(writeEntry).not.toHaveBeenCalled()
        })

        it('skips a secret that is not a P-256 private key', async () => {
            const pulled = await buildPulledWithSecret()
            const { result } = renderHook(() =>
                useCloudBackupPasskeyImport(resolveEntropy),
            )

            const summary = await result.current.importPasskeys([
                {
                    ...pulled,
                    secret: { ...pulled.secret, privateKey: 'AAAA' },
                },
            ])

            expect(summary.skipped[0]?.reason).toBe('pubkey-mismatch')
            expect(writeEntry).not.toHaveBeenCalled()
        })

        it('zeroes the decoded private key once it is written', async () => {
            const pulled = await buildPulledWithSecret()
            let handed: Uint8Array | undefined
            writeEntry.mockImplementationOnce(
                async (params: { privateKey: Uint8Array }) => {
                    handed = params.privateKey
                    expect(handed.some(byte => byte !== 0)).toBe(true)
                },
            )
            const { result } = renderHook(() =>
                useCloudBackupPasskeyImport(resolveEntropy),
            )

            await result.current.importPasskeys([pulled])

            expect(handed!.every(byte => byte === 0)).toBe(true)
        })
    })

    describe('without a backed-up private key', () => {
        it('re-derives a credential whose public key matches', async () => {
            const { result } = renderHook(() =>
                useCloudBackupPasskeyImport(resolveEntropy),
            )

            const summary = await result.current.importPasskeys([
                await withoutSecret(),
            ])

            expect(summary.imported).toBe(1)
            expect(writeEntry).toHaveBeenCalledTimes(1)
        })

        it('records the local parent key id and the derivation counter', async () => {
            const { result } = renderHook(() =>
                useCloudBackupPasskeyImport(resolveEntropy),
            )

            await result.current.importPasskeys([
                await withoutSecret({ counter: 3 }),
            ])

            expect(writeEntry).toHaveBeenCalledWith(
                expect.objectContaining({
                    parentKeyId: 'local-seed-id-passkey-main',
                    counter: 3,
                    identity: 'alice',
                }),
            )
        })

        it('skips and never writes when the derived public key disagrees', async () => {
            const { result } = renderHook(() =>
                useCloudBackupPasskeyImport(resolveEntropy),
            )

            const summary = await result.current.importPasskeys([
                await withoutSecret({ publicKeySpkiDer: 'd3Jvbmc=' }),
            ])

            expect(summary.imported).toBe(0)
            expect(summary.skipped[0]?.reason).toBe('pubkey-mismatch')
            expect(writeEntry).not.toHaveBeenCalled()
        })

        it('skips when the owning seed is not on this device', async () => {
            const { result } = renderHook(() =>
                useCloudBackupPasskeyImport(resolveEntropy),
            )

            const summary = await result.current.importPasskeys([
                await withoutSecret({ seedAddress: 'OTHER' }),
            ])

            expect(summary.skipped[0]?.reason).toBe('seed-missing')
            expect(writeEntry).not.toHaveBeenCalled()
        })

        it('skips when the record carries no derivation inputs either', async () => {
            const { payload } = await buildPulledWithSecret()
            const { result } = renderHook(() =>
                useCloudBackupPasskeyImport(resolveEntropy),
            )

            const summary = await result.current.importPasskeys([
                { payload, secret: null },
            ])

            expect(summary.skipped[0]?.reason).toBe('secret-missing')
            expect(resolveEntropy).not.toHaveBeenCalled()
            expect(writeEntry).not.toHaveBeenCalled()
        })

        it('zeroes the derived private key once it is written', async () => {
            const pulled = await withoutSecret()
            const written: Uint8Array[] = []
            writeEntry.mockImplementationOnce(
                async (params: { privateKey: Uint8Array }) => {
                    written.push(Uint8Array.from(params.privateKey))
                },
            )
            vi.mocked(derivePasskeyCredential).mockClear()
            const { result } = renderHook(() =>
                useCloudBackupPasskeyImport(resolveEntropy),
            )

            await result.current.importPasskeys([pulled])

            const [derived] = await derivedSinceClear()
            expect(written[0]!.some(byte => byte !== 0)).toBe(true)
            expect(derived!.privateKey.every(byte => byte === 0)).toBe(true)
        })

        it('zeroes the derived private key when the public key disagrees', async () => {
            const pulled = await withoutSecret({ publicKeySpkiDer: 'd3Jvbmc=' })
            vi.mocked(derivePasskeyCredential).mockClear()
            const { result } = renderHook(() =>
                useCloudBackupPasskeyImport(resolveEntropy),
            )

            await result.current.importPasskeys([pulled])

            const [derived] = await derivedSinceClear()
            expect(derived!.privateKey.every(byte => byte === 0)).toBe(true)
        })

        it('zeroes the derived private key when the write fails', async () => {
            const pulled = await withoutSecret()
            writeEntry.mockRejectedValueOnce(new Error('keystore unavailable'))
            vi.mocked(derivePasskeyCredential).mockClear()
            const { result } = renderHook(() =>
                useCloudBackupPasskeyImport(resolveEntropy),
            )

            const summary = await result.current.importPasskeys([pulled])

            const [derived] = await derivedSinceClear()
            expect(summary.failed).toHaveLength(1)
            expect(derived!.privateKey.every(byte => byte === 0)).toBe(true)
        })

        it('zeroes the seed entropy when the main-key derivation fails', async () => {
            const pulled = await withoutSecret()
            vi.mocked(derivePasskeyMainKey).mockRejectedValueOnce(
                new Error('kdf unavailable'),
            )
            const { result } = renderHook(() =>
                useCloudBackupPasskeyImport(resolveEntropy),
            )

            const summary = await result.current.importPasskeys([pulled])

            const resolved: ResolvedSeed | null =
                await resolveEntropy.mock.results[0]!.value
            expect(summary.failed).toHaveLength(1)
            expect(resolved!.entropy.every(byte => byte === 0)).toBe(true)
        })

        it('derives the main key once per seed across several credentials', async () => {
            const first = await withoutSecret()
            const second = await withoutSecret({ identity: 'bob' })
            resolveEntropy.mockClear()
            const { result } = renderHook(() =>
                useCloudBackupPasskeyImport(resolveEntropy),
            )

            await result.current.importPasskeys([first, second])

            expect(resolveEntropy).toHaveBeenCalledTimes(1)
        })
    })

    it('does not clobber a credential the device already holds', async () => {
        entryExists.mockReturnValue(true)
        const { result } = renderHook(() =>
            useCloudBackupPasskeyImport(resolveEntropy),
        )

        const summary = await result.current.importPasskeys([
            await buildPulledWithSecret(),
        ])

        expect(summary.skipped[0]?.reason).toBe('already-present')
        expect(writeEntry).not.toHaveBeenCalled()
    })

    describe('publishing to the iOS identity store', () => {
        it('refreshes the identities once a credential is written', async () => {
            const { result } = renderHook(() =>
                useCloudBackupPasskeyImport(resolveEntropy),
            )

            await result.current.importPasskeys([
                await buildPulledWithSecret('carol'),
                await buildPulledWithSecret('dave'),
            ])

            expect(refreshIdentities).toHaveBeenCalledTimes(1)
        })

        it('does not refresh when nothing was written', async () => {
            entryExists.mockReturnValue(true)
            const { result } = renderHook(() =>
                useCloudBackupPasskeyImport(resolveEntropy),
            )

            await result.current.importPasskeys([await buildPulledWithSecret()])

            expect(refreshIdentities).not.toHaveBeenCalled()
        })

        it('still reports the import when the refresh fails', async () => {
            refreshIdentities.mockRejectedValue(
                new Error('ASCredentialIdentityStoreErrorDomain error 1'),
            )
            const { result } = renderHook(() =>
                useCloudBackupPasskeyImport(resolveEntropy),
            )

            const summary = await result.current.importPasskeys([
                await buildPulledWithSecret(),
            ])

            expect(summary.imported).toBe(1)
        })
    })
})
