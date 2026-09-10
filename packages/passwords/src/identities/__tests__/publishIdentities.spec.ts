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

import { describe, expect, it, vi } from 'vitest'

// vi.mock factories run before the rest of this module is evaluated, so
// the mocked fn can only be shared via vi.hoisted.
const { listLogins } = vi.hoisted(() => ({ listLogins: vi.fn() }))
vi.mock('../../storage/loginStore', () => ({ listLogins }))

import {
    publishLoginIdentities,
    toPasswordIdentities,
} from '../publishIdentities'

const login = {
    id: 'pera.login.abc',
    domain: 'example.com',
    username: 'ada@example.com',
    note: null,
    createdAt: 1,
    updatedAt: 1,
}

describe('toPasswordIdentities', () => {
    it('maps a login to its OS index row', () => {
        expect(toPasswordIdentities([login])).toEqual([
            {
                recordIdentifier: 'pera.login.abc',
                serviceIdentifier: 'example.com',
                user: 'ada@example.com',
            },
        ])
    })

    it('drops a login with no domain, which the OS cannot match', () => {
        expect(toPasswordIdentities([{ ...login, domain: '' }])).toEqual([])
    })
})

describe('publishLoginIdentities', () => {
    it('publishes the full current set, not a delta', async () => {
        listLogins.mockResolvedValue([login])
        const replacePasswordCredentialIdentities = vi.fn(async () => undefined)

        await publishLoginIdentities({ replacePasswordCredentialIdentities })

        expect(replacePasswordCredentialIdentities).toHaveBeenCalledWith([
            {
                recordIdentifier: 'pera.login.abc',
                serviceIdentifier: 'example.com',
                user: 'ada@example.com',
            },
        ])
    })

    it('swallows a native failure so a publish never breaks a mutation', async () => {
        listLogins.mockResolvedValue([login])
        const replacePasswordCredentialIdentities = vi.fn(async () => {
            throw new Error('no provider')
        })

        await expect(
            publishLoginIdentities({ replacePasswordCredentialIdentities }),
        ).resolves.toBeUndefined()
    })
})
