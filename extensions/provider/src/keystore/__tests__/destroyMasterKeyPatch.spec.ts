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

// @vitest-environment node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

class MasterKeyNotFoundError extends Error {}

type KeychainFake = ReturnType<typeof createKeychainFake>

const createKeychainFake = () => {
    const items = new Map<string, string>()
    return {
        items,
        getGenericPassword: vi.fn(async ({ service }: { service: string }) => {
            const password = items.get(service)
            return password === undefined ? false : { password }
        }),
        setGenericPassword: vi.fn(
            async (
                _user: string,
                password: string,
                { service }: { service: string },
            ) => {
                items.set(service, password)
                return true
            },
        ),
        resetGenericPassword: vi.fn(
            async ({ service }: { service: string }) => {
                items.delete(service)
                return true
            },
        ),
    }
}

type PatchedCrypto = {
    MASTER_KEY_SERVICES: readonly string[]
    destroyMasterKey: () => Promise<void>
    readMasterKey: () => Promise<Buffer>
    createMasterKey: () => Promise<Buffer>
}

/**
 * Evaluates the patched dist `crypto.js` against a Keychain fake. The package
 * is externalised, so `vi.mock` cannot reach its `react-native-keychain`
 * import; its imports are passed in as parameters instead.
 */
const loadPatchedCrypto = (keychain: KeychainFake): PatchedCrypto => {
    const source = readFileSync(
        resolve(
            __dirname,
            '../../../node_modules/@algorandfoundation/react-native-keystore/dist/storage/crypto.js',
        ),
        'utf8',
    )
        .replace(/^import .*$/gm, '')
        .replace(/^export /gm, '')
    // oxlint-disable-next-line no-new-func -- evaluates the patched dependency file under test
    const factory = new Function(
        'Keychain',
        'MasterKeyNotFoundError',
        'UnlockingError',
        'resolveAuthenticationPrompt',
        'randomBytes',
        'base64',
        `${source}\nreturn { MASTER_KEY_SERVICES, destroyMasterKey, readMasterKey, createMasterKey }`,
    )
    return factory(
        keychain,
        MasterKeyNotFoundError,
        Error,
        () => undefined,
        () => new Uint8Array(32),
        {},
    ) as PatchedCrypto
}

const OLD_KEY = 'aa'.repeat(32)

describe('patched destroyMasterKey', () => {
    let keychain: KeychainFake
    let crypto: PatchedCrypto

    beforeEach(() => {
        vi.restoreAllMocks()
        keychain = createKeychainFake()
        crypto = loadPatchedCrypto(keychain)
    })

    it('lists the StrongBox key and its TEE copy', () => {
        expect([...crypto.MASTER_KEY_SERVICES].sort()).toEqual([
            'app-secret',
            'app-secret-tee',
        ])
    })

    it('deletes every master-key copy, so a read after it finds none', async () => {
        keychain.items.set('app-secret', OLD_KEY)
        keychain.items.set('app-secret-tee', OLD_KEY)
        await crypto.readMasterKey()

        await crypto.destroyMasterKey()

        for (const service of crypto.MASTER_KEY_SERVICES) {
            expect(keychain.resetGenericPassword).toHaveBeenCalledWith({
                service,
            })
        }
        expect(keychain.items.size).toBe(0)
        await expect(crypto.readMasterKey()).rejects.toBeInstanceOf(
            MasterKeyNotFoundError,
        )
    })

    it('waits for a pending TEE copy before deleting both master-key copies', async () => {
        keychain.items.set('app-secret', OLD_KEY)
        let releaseCopy: () => void = () => {}
        const copyGate = new Promise<void>(resolve => {
            releaseCopy = resolve
        })
        keychain.setGenericPassword.mockImplementationOnce(
            async (_user, password, { service }) => {
                await copyGate
                keychain.items.set(service, password)
                return true
            },
        )
        const now = vi.spyOn(Date, 'now')
        now.mockReturnValueOnce(0).mockReturnValueOnce(5_000)
        await crypto.readMasterKey()

        const wiping = crypto.destroyMasterKey()
        expect(keychain.resetGenericPassword).not.toHaveBeenCalled()
        releaseCopy()
        await wiping

        expect(keychain.items.has('app-secret-tee')).toBe(false)
        expect(keychain.resetGenericPassword).toHaveBeenCalledTimes(2)
    })

    it('discards a master-key read that finishes after destruction', async () => {
        let finishRead: (value: { password: string }) => void = () => {}
        keychain.getGenericPassword
            .mockResolvedValueOnce(false)
            .mockReturnValueOnce(
                new Promise(resolve => {
                    finishRead = resolve
                }),
            )
        const reading = crypto.readMasterKey()
        const staleRead = expect(reading).rejects.toThrow('Master key changed')
        await vi.waitFor(() =>
            expect(keychain.getGenericPassword).toHaveBeenCalledTimes(2),
        )

        await crypto.destroyMasterKey()
        finishRead({ password: OLD_KEY })
        await staleRead

        expect(keychain.setGenericPassword).not.toHaveBeenCalled()
    })

    it('tries to delete the other key when deleting the first copy fails', async () => {
        keychain.items.set('app-secret', OLD_KEY)
        keychain.items.set('app-secret-tee', OLD_KEY)
        keychain.resetGenericPassword.mockRejectedValueOnce(new Error('busy'))

        await expect(crypto.destroyMasterKey()).rejects.toThrow(
            'Failed to delete all master-key copies',
        )

        expect(keychain.items.has('app-secret')).toBe(false)
    })

    it('writes and reads a fresh master key after destruction', async () => {
        keychain.items.set('app-secret', OLD_KEY)
        keychain.items.set('app-secret-tee', OLD_KEY)

        await crypto.destroyMasterKey()
        const fresh = await crypto.createMasterKey()

        expect(fresh.toString('hex')).not.toBe(OLD_KEY)
        await expect(crypto.readMasterKey()).resolves.toEqual(fresh)
    })
})
