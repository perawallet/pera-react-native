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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createChromeFake, type ChromeFake } from '../../test-utils/chrome'
import {
    readPasskeySetupPending,
    writePasskeySetupPending,
} from '../passkey-setup'
import { createVault, destroyVault, lockVault } from '../vault'

vi.mock('../argon2', async importOriginal =>
    (await import('../../test-utils/argon2')).fastArgon2(
        await importOriginal(),
    ),
)

describe('passkey setup pending flag', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('reads false while nothing was written', async () => {
        expect(await readPasskeySetupPending()).toBe(false)
    })

    it('round-trips through session storage', async () => {
        await writePasskeySetupPending(true)
        expect(fake.sessionData.get('vault:passkey-setup-pending')).toBe(true)
        expect(await readPasskeySetupPending()).toBe(true)
        await writePasskeySetupPending(false)
        expect(await readPasskeySetupPending()).toBe(false)
    })

    it('survives lockVault, so a mid-ceremony lock brings the step back', async () => {
        await createVault('pw')
        await writePasskeySetupPending(true)
        await lockVault()
        expect(await readPasskeySetupPending()).toBe(true)
    })

    it('is removed by destroyVault', async () => {
        await createVault('pw')
        await writePasskeySetupPending(true)
        await destroyVault()
        expect(await readPasskeySetupPending()).toBe(false)
    })
})
