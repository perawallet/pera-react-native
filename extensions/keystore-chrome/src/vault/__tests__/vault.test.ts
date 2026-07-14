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
    PBKDF2_ITERATIONS,
    PBKDF2_MAX_ITERATIONS,
} from '../vault'
import { getSessionMasterKey } from '../session'
import {
    InvalidPasswordError,
    VaultCorruptedError,
    VaultExistsError,
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
        expect(blob.version).toBe(1)
        expect(blob.kdf).toBe('PBKDF2-SHA256')
        expect(blob.iterations).toBe(600_000)
        expect(PBKDF2_ITERATIONS).toBe(600_000)
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

    it('rejects a downgraded iteration count as corruption', async () => {
        await createVault('correct horse')
        const blob = JSON.parse(
            String(fake.data.get('vault:wrapped-master-key')),
        )
        blob.iterations = 1000
        fake.data.set('vault:wrapped-master-key', JSON.stringify(blob))
        await expect(unlockVault('correct horse')).rejects.toBeInstanceOf(
            VaultCorruptedError,
        )
    })

    it('rejects an iterations count above PBKDF2_MAX_ITERATIONS as corruption (DoS ceiling)', async () => {
        await createVault('correct horse')
        const blob = JSON.parse(
            String(fake.data.get('vault:wrapped-master-key')),
        )
        blob.iterations = PBKDF2_MAX_ITERATIONS + 1
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
})
