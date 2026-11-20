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
import {
    createChromeFake,
    type ChromeFake,
} from '@perawallet/wallet-extension-platform-chrome/test-utils'
import {
    KV_AUTH_KEY_SCOPE,
    installKvAuthKeyHost,
    requestKvAuthKey,
} from '../kv-auth-key'

const KEY = Uint8Array.from({ length: 32 }, (_, i) => i)
const CONTENT_SCRIPT_SENDER = {
    id: 'test-extension-id',
    url: 'https://dapp.example/',
}
const POPUP_SENDER = {
    id: 'test-extension-id',
    url: 'chrome-extension://test-extension-id/index.html',
}

describe('kv auth key channel', () => {
    let fake: ChromeFake
    let readKvAuthKey: ReturnType<
        typeof vi.fn<() => Promise<Uint8Array | null>>
    >

    beforeEach(() => {
        fake = createChromeFake()
        readKvAuthKey = vi.fn(async () => new Uint8Array(KEY))
        installKvAuthKeyHost({ chromeLike: fake.chrome, readKvAuthKey })
    })

    it('hands the offscreen document the key as hex', async () => {
        expect(await requestKvAuthKey(fake.chrome)).toEqual(KEY)
    })

    it('answers an empty reply while the key is absent', async () => {
        readKvAuthKey.mockResolvedValue(null)

        expect(await requestKvAuthKey(fake.chrome)).toBeNull()
    })

    it('answers an empty reply when the worker cannot read the key', async () => {
        readKvAuthKey.mockRejectedValue(new Error('session unavailable'))

        expect(await requestKvAuthKey(fake.chrome)).toBeNull()
    })

    it.each([
        ['a popup', POPUP_SENDER],
        ['a web page', CONTENT_SCRIPT_SENDER],
        [
            'another extension',
            { id: 'other', url: 'chrome-extension://other/offscreen.html' },
        ],
    ])('refuses %s', async (_label, sender) => {
        const answer = await fake.chrome.runtime
            .sendMessage({ scope: KV_AUTH_KEY_SCOPE, kind: 'get' }, sender)
            .catch(() => 'unanswered')

        expect(answer).toBe('unanswered')
        expect(readKvAuthKey).not.toHaveBeenCalled()
    })

    it.each([
        ['an empty answer', {}],
        ['a non-hex key', { key: 'zz'.repeat(32) }],
        ['a short key', { key: 'ab' }],
    ])('requestKvAuthKey treats %s as no key', async (_label, answer) => {
        const chromeLike = {
            runtime: { sendMessage: vi.fn(async () => answer) },
        } as unknown as typeof chrome

        expect(await requestKvAuthKey(chromeLike)).toBeNull()
    })

    it('requestKvAuthKey treats a rejection as no key', async () => {
        const chromeLike = {
            runtime: {
                sendMessage: vi.fn(async () => {
                    throw new Error('no receiver')
                }),
            },
        } as unknown as typeof chrome

        expect(await requestKvAuthKey(chromeLike)).toBeNull()
    })
})
