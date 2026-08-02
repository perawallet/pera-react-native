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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { base64 } from '@scure/base'
import { createChromeFake, type ChromeFake } from '../../test-utils/chrome'
import {
    createVault,
    changePassword,
    isUnlocked,
    isVaultInitialized,
    lockVault,
    onLockStateChanged,
    unlockVault,
    verifyVaultPassword,
    ARGON2_MEMORY_KIB,
    ARGON2_ITERATIONS,
    ARGON2_PARALLELISM,
    PBKDF2_ITERATIONS,
} from '../vault'
import { getSessionMasterKey } from '../session'
import {
    InvalidPasswordError,
    VaultCorruptedError,
    VaultExistsError,
    VaultLockedOutError,
    VaultNotInitializedError,
} from '../../errors'

describe('vault', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('is uninitialized and locked before creation', async () => {
        expect(await isVaultInitialized()).toBe(false)
        expect(await isUnlocked()).toBe(false)
        await expect(unlockVault('pw')).rejects.toBeInstanceOf(
            VaultNotInitializedError,
        )
    })

    it('createVault initializes, unlocks, and stores a 32-byte session key', async () => {
        await createVault('correct horse battery staple')
        expect(await isVaultInitialized()).toBe(true)
        expect(await isUnlocked()).toBe(true)
        const key = await getSessionMasterKey()
        expect(key).toHaveLength(32)
    })

    it('rejects double creation', async () => {
        await createVault('pw-one')
        await expect(createVault('pw-two')).rejects.toBeInstanceOf(
            VaultExistsError,
        )
    })

    it('locks and unlocks with the right password (same master key)', async () => {
        await createVault('the-password')
        const before = await getSessionMasterKey()
        await lockVault()
        expect(await isUnlocked()).toBe(false)
        expect(await getSessionMasterKey()).toBeNull()
        await unlockVault('the-password')
        expect(await getSessionMasterKey()).toEqual(before)
    })

    it('rejects a wrong password and stays locked', async () => {
        await createVault('the-password')
        await lockVault()
        await expect(unlockVault('wrong-password')).rejects.toBeInstanceOf(
            InvalidPasswordError,
        )
        expect(await isUnlocked()).toBe(false)
    })

    it('changePassword requires the current password and preserves the master key', async () => {
        await createVault('old-password')
        const master = await getSessionMasterKey()
        await expect(
            changePassword('not-the-old-one', 'new-password'),
        ).rejects.toBeInstanceOf(InvalidPasswordError)
        await changePassword('old-password', 'new-password')
        await lockVault()
        await expect(unlockVault('old-password')).rejects.toBeInstanceOf(
            InvalidPasswordError,
        )
        await unlockVault('new-password')
        expect(await getSessionMasterKey()).toEqual(master)
    })

    it('notifies lock-state listeners on session changes', async () => {
        const listener = vi.fn()
        const unsubscribe = onLockStateChanged(listener)
        await createVault('pw')
        expect(listener).toHaveBeenLastCalledWith(true)
        await lockVault()
        expect(listener).toHaveBeenLastCalledWith(false)
        unsubscribe()
        await unlockVault('pw')
        expect(listener).toHaveBeenCalledTimes(2)
    })

    it('persists the vault blob with the pinned KDF parameters', async () => {
        await createVault('correct horse')
        const raw = fake.data.get('vault:wrapped-master-key')
        const blob = JSON.parse(String(raw))
        expect(blob.version).toBe(2)
        expect(blob.kdf).toBe('Argon2id')
        // Pinned against OWASP's baseline (19 MiB, t=2, p=1). Memory-hardness
        // is the point — see the constants' doc comment.
        expect(blob.m).toBe(19_456)
        expect(blob.t).toBe(2)
        expect(blob.p).toBe(1)
        expect(ARGON2_MEMORY_KIB).toBe(19_456)
        expect(ARGON2_ITERATIONS).toBe(2)
        expect(ARGON2_PARALLELISM).toBe(1)
        expect(base64.decode(blob.salt)).toHaveLength(16)
        expect(base64.decode(blob.iv)).toHaveLength(12)
    })

    it('surfaces corrupted vault data as VaultCorruptedError, not invalid password', async () => {
        await createVault('correct horse')
        fake.data.set('vault:wrapped-master-key', 'not-json{')
        await expect(unlockVault('correct horse')).rejects.toBeInstanceOf(
            VaultCorruptedError,
        )
    })

    // Existing installs hold PBKDF2 `version: 1` blobs. They must keep
    // opening, and must not stay on the weaker KDF forever.
    describe('legacy PBKDF2 (version 1) blobs', () => {
        const writeLegacyBlob = async (
            password: string,
            masterKey: Uint8Array,
        ): Promise<void> => {
            const salt = new Uint8Array(16).fill(3)
            const iv = new Uint8Array(12).fill(5)
            const material = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(password),
                'PBKDF2',
                false,
                ['deriveKey'],
            )
            const kek = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    hash: 'SHA-256',
                    salt,
                    iterations: PBKDF2_ITERATIONS,
                },
                material,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt'],
            )
            const ciphertext = new Uint8Array(
                await crypto.subtle.encrypt(
                    { name: 'AES-GCM', iv },
                    kek,
                    masterKey,
                ),
            )
            fake.data.set(
                'vault:wrapped-master-key',
                JSON.stringify({
                    version: 1,
                    kdf: 'PBKDF2-SHA256',
                    iterations: PBKDF2_ITERATIONS,
                    salt: base64.encode(salt),
                    iv: base64.encode(iv),
                    ciphertext: base64.encode(ciphertext),
                }),
            )
        }

        const LEGACY_MASTER_KEY = new Uint8Array(32).fill(9)

        it('still unlock with the original password', async () => {
            await writeLegacyBlob('legacy-password', LEGACY_MASTER_KEY)

            await unlockVault('legacy-password')

            expect(await getSessionMasterKey()).toEqual(LEGACY_MASTER_KEY)
        })

        it('are re-wrapped as Argon2id on that unlock, preserving the master key', async () => {
            await writeLegacyBlob('legacy-password', LEGACY_MASTER_KEY)

            await unlockVault('legacy-password')

            const migrated = JSON.parse(
                String(fake.data.get('vault:wrapped-master-key')),
            )
            expect(migrated.version).toBe(2)
            expect(migrated.kdf).toBe('Argon2id')

            // The upgraded blob opens with the same password and yields the
            // same key — a migration that changed either would lock the user
            // out of their own wallet.
            await lockVault()
            await unlockVault('legacy-password')
            expect(await getSessionMasterKey()).toEqual(LEGACY_MASTER_KEY)
        })

        it('reject a wrong password without migrating anything', async () => {
            await writeLegacyBlob('legacy-password', LEGACY_MASTER_KEY)

            await expect(unlockVault('wrong-password')).rejects.toBeInstanceOf(
                InvalidPasswordError,
            )

            const untouched = JSON.parse(
                String(fake.data.get('vault:wrapped-master-key')),
            )
            expect(untouched.version).toBe(1)
        })
    })

    it('rejects downgraded Argon2 cost parameters as corruption', async () => {
        await createVault('correct horse')
        const blob = JSON.parse(
            String(fake.data.get('vault:wrapped-master-key')),
        )
        // An attacker with write access to the profile could otherwise rewrite
        // the blob's own cost down and brute-force a near-unprotected password.
        blob.m = 8
        fake.data.set('vault:wrapped-master-key', JSON.stringify(blob))
        await expect(unlockVault('correct horse')).rejects.toBeInstanceOf(
            VaultCorruptedError,
        )
    })

    it('rejects an Argon2 memory cost above the ceiling as corruption (OOM guard)', async () => {
        await createVault('correct horse')
        const blob = JSON.parse(
            String(fake.data.get('vault:wrapped-master-key')),
        )
        // `m` is a real allocation, so an unbounded value is an OOM rather
        // than merely a slow unlock.
        blob.m = 1_000_000
        fake.data.set('vault:wrapped-master-key', JSON.stringify(blob))
        await expect(unlockVault('correct horse')).rejects.toBeInstanceOf(
            VaultCorruptedError,
        )
    })

    it('rejects a salt that decodes to the wrong byte length as corruption, not invalid password', async () => {
        await createVault('correct horse')
        const blob = JSON.parse(
            String(fake.data.get('vault:wrapped-master-key')),
        )
        blob.salt = base64.encode(new Uint8Array(3)) // not 16 bytes
        fake.data.set('vault:wrapped-master-key', JSON.stringify(blob))
        await expect(unlockVault('correct horse')).rejects.toBeInstanceOf(
            VaultCorruptedError,
        )
    })

    it('rejects an iv that decodes to the wrong byte length as corruption', async () => {
        await createVault('correct horse')
        const blob = JSON.parse(
            String(fake.data.get('vault:wrapped-master-key')),
        )
        blob.iv = base64.encode(new Uint8Array(4)) // not 12 bytes
        fake.data.set('vault:wrapped-master-key', JSON.stringify(blob))
        await expect(unlockVault('correct horse')).rejects.toBeInstanceOf(
            VaultCorruptedError,
        )
    })

    it('locks out after 5 wrong passwords, rejecting even the correct one', async () => {
        await createVault('the-password')
        await lockVault()
        for (let i = 0; i < 5; i++) {
            await expect(unlockVault('wrong-password')).rejects.toBeInstanceOf(
                InvalidPasswordError,
            )
        }
        await expect(unlockVault('the-password')).rejects.toBeInstanceOf(
            VaultLockedOutError,
        )
        expect(await isUnlocked()).toBe(false)
    })

    // Every password check shares one throttle. These two are reachable from
    // an already-unlocked session, where the value at stake is the password
    // itself — and they used to check it without consulting or recording an
    // attempt, making them unmetered guessing oracles.
    describe('brute-force throttling covers every password entry point', () => {
        it('locks out changePassword after repeated wrong current passwords', async () => {
            await createVault('the-password')
            for (let i = 0; i < 5; i++) {
                await expect(
                    changePassword('wrong-password', 'next-password'),
                ).rejects.toBeInstanceOf(InvalidPasswordError)
            }
            await expect(
                changePassword('the-password', 'next-password'),
            ).rejects.toBeInstanceOf(VaultLockedOutError)
        })

        it('locks out verifyVaultPassword after repeated wrong passwords', async () => {
            await createVault('the-password')
            for (let i = 0; i < 5; i++) {
                expect(await verifyVaultPassword('wrong-password')).toBe(false)
            }
            await expect(
                verifyVaultPassword('the-password'),
            ).rejects.toBeInstanceOf(VaultLockedOutError)
        })

        it('a wrong attempt on one entry point counts against the others', async () => {
            await createVault('the-password')
            for (let i = 0; i < 4; i++) {
                expect(await verifyVaultPassword('wrong-password')).toBe(false)
            }
            // Fifth failure arrives via a different entry point.
            await expect(
                changePassword('wrong-password', 'next-password'),
            ).rejects.toBeInstanceOf(InvalidPasswordError)

            await expect(unlockVault('the-password')).rejects.toBeInstanceOf(
                VaultLockedOutError,
            )
        })

        it('a successful check clears the accumulated attempts', async () => {
            await createVault('the-password')
            for (let i = 0; i < 4; i++) {
                expect(await verifyVaultPassword('wrong-password')).toBe(false)
            }
            expect(await verifyVaultPassword('the-password')).toBe(true)

            // The counter reset, so five fresh failures are needed again.
            for (let i = 0; i < 4; i++) {
                expect(await verifyVaultPassword('wrong-password')).toBe(false)
            }
            expect(await verifyVaultPassword('the-password')).toBe(true)
        })
    })

    describe('verifyVaultPassword', () => {
        it('confirms the password without unlocking or touching the session', async () => {
            await createVault('the-password')
            await lockVault()

            expect(await verifyVaultPassword('the-password')).toBe(true)
            // Verification is not authentication: a locked vault stays locked.
            expect(await isUnlocked()).toBe(false)
        })

        it('returns false rather than throwing on a wrong password', async () => {
            await createVault('the-password')
            expect(await verifyVaultPassword('nope')).toBe(false)
        })
    })
})
