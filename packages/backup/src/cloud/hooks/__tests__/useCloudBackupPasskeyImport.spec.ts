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
} from '@perawallet/wallet-core-passkeys'
import { useCloudBackupPasskeyImport } from '../useCloudBackupPasskeyImport'

const subtle = webcrypto.subtle as unknown as SubtleCrypto
const ENTROPY = new Uint8Array(32).fill(7)

const writeEntry = vi.fn()
const entryExists = vi.fn().mockReturnValue(false)
// A fresh copy per call, like the real resolver: the import zeroes what it is
// handed, so a shared buffer would be blanked for every later test.
const resolveEntropy = vi.fn(async (seedAddress: string) =>
    seedAddress === 'SEEDADDRESS'
        ? { seedKeyId: 'local-seed-id', entropy: new Uint8Array(ENTROPY) }
        : null,
)

vi.mock('@perawallet/wallet-core-passkeys', async importOriginal => ({
    ...(await importOriginal<object>()),
    writeNativePasskeyEntry: (...args: unknown[]) => writeEntry(...args),
    nativePasskeyEntryExists: (...args: unknown[]) => entryExists(...args),
}))

const buildPayload = async (
    overrides: { identity?: string; counter?: number } & Record<
        string,
        unknown
    > = {},
) => {
    const identity = overrides.identity ?? 'alice'
    const counter = overrides.counter ?? 0
    const mainKey = await derivePasskeyMainKey(ENTROPY, subtle)
    // Derived with the same counter the payload carries, or the public key
    // would not match and every such payload would skip.
    const derived = await derivePasskeyCredential({
        mainKey,
        origin: 'webauthn.io',
        identity,
        counter,
    })
    return {
        credentialId: derived.credentialId,
        origin: 'webauthn.io',
        identity,
        counter,
        publicKeySpkiDer: Buffer.from(derived.publicKeySpkiDer).toString(
            'base64',
        ),
        seedAddress: 'SEEDADDRESS',
        userId: 'dXNlcg==',
        userName: 'alice',
        displayName: 'Alice',
        createdAt: 1,
        ...overrides,
    }
}

describe('useCloudBackupPasskeyImport', () => {
    beforeEach(() => {
        writeEntry.mockClear()
        entryExists.mockReturnValue(false)
    })

    it('writes a credential whose derived public key matches', async () => {
        const payload = await buildPayload()
        const { result } = renderHook(() =>
            useCloudBackupPasskeyImport(resolveEntropy),
        )

        const summary = await result.current.importPasskeys([payload])

        expect(summary.imported).toBe(1)
        expect(writeEntry).toHaveBeenCalledTimes(1)
    })

    // Without these the credential is unprovable on the device that just
    // restored it, which reports it as one it cannot back up.
    it('records the local parent key id and the derivation counter', async () => {
        const payload = await buildPayload({ counter: 3 })
        const { result } = renderHook(() =>
            useCloudBackupPasskeyImport(resolveEntropy),
        )

        await result.current.importPasskeys([payload])

        expect(writeEntry).toHaveBeenCalledWith(
            expect.objectContaining({
                parentKeyId: 'local-seed-id-passkey-main',
                counter: 3,
                identity: 'alice',
            }),
        )
    })

    it('skips and never writes when the derived public key disagrees', async () => {
        const payload = await buildPayload({ publicKeySpkiDer: 'd3Jvbmc=' })
        const { result } = renderHook(() =>
            useCloudBackupPasskeyImport(resolveEntropy),
        )

        const summary = await result.current.importPasskeys([payload])

        expect(summary.imported).toBe(0)
        expect(summary.skipped[0].reason).toBe('pubkey-mismatch')
        expect(writeEntry).not.toHaveBeenCalled()
    })

    it('skips when the owning seed is not on this device', async () => {
        const payload = await buildPayload({ seedAddress: 'OTHER' })
        const { result } = renderHook(() =>
            useCloudBackupPasskeyImport(resolveEntropy),
        )

        const summary = await result.current.importPasskeys([payload])

        expect(summary.skipped[0].reason).toBe('seed-missing')
        expect(writeEntry).not.toHaveBeenCalled()
    })

    it('does not clobber a credential the device already holds', async () => {
        entryExists.mockReturnValue(true)
        const payload = await buildPayload()
        const { result } = renderHook(() =>
            useCloudBackupPasskeyImport(resolveEntropy),
        )

        const summary = await result.current.importPasskeys([payload])

        expect(summary.skipped[0].reason).toBe('already-present')
        expect(writeEntry).not.toHaveBeenCalled()
    })

    it('derives the main key once per seed across several credentials', async () => {
        const first = await buildPayload()
        const second = await buildPayload({ identity: 'bob' })
        resolveEntropy.mockClear()
        const { result } = renderHook(() =>
            useCloudBackupPasskeyImport(resolveEntropy),
        )

        await result.current.importPasskeys([first, second])

        expect(resolveEntropy).toHaveBeenCalledTimes(1)
    })
})
