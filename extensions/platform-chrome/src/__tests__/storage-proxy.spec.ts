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
    installOffscreenStorageShim,
    STORAGE_EVENT_SCOPE,
    STORAGE_PROXY_SCOPE,
    startStorageProxyHost,
} from '../storage-proxy'
import { ChromeKeyValueStorageService } from '../services/key-value-storage'
import { createChromeFake, type ChromeFake } from '../test-utils/chrome'

// Simulates the two real contexts: the service worker (full chrome.storage)
// and the offscreen document (chrome.runtime only), sharing one message bus.
describe('storage proxy', () => {
    let fake: ChromeFake
    let offscreenChrome: typeof chrome

    beforeEach(() => {
        fake = createChromeFake()
        startStorageProxyHost(fake.chrome)
        offscreenChrome = {
            runtime: fake.chrome.runtime,
        } as unknown as typeof chrome
        installOffscreenStorageShim(offscreenChrome)
    })

    it('installs a chrome.storage.local lookalike when storage is missing', () => {
        expect(offscreenChrome.storage).toBeDefined()
        expect(offscreenChrome.storage.local).toBeDefined()
        expect(offscreenChrome.storage.onChanged).toBeDefined()
    })

    it('does not overwrite an existing chrome.storage (non-offscreen contexts)', () => {
        const realStorage = fake.chrome.storage
        installOffscreenStorageShim(fake.chrome)
        expect(fake.chrome.storage).toBe(realStorage)
    })

    it('set/get round-trips through the service worker host', async () => {
        await offscreenChrome.storage.local.set({ 'kv:foo': 'bar' })
        expect(fake.data.get('kv:foo')).toBe('bar')

        const result = await offscreenChrome.storage.local.get('kv:foo')
        expect(result).toEqual({ 'kv:foo': 'bar' })
    })

    it('get(null) returns every stored entry (hydrate path)', async () => {
        fake.data.set('kv:a', '1')
        fake.data.set('keystore:b', '2')

        const all = await offscreenChrome.storage.local.get(null)
        expect(all).toEqual({ 'kv:a': '1', 'keystore:b': '2' })
    })

    it('remove deletes entries through the host', async () => {
        fake.data.set('kv:gone', 'x')
        await offscreenChrome.storage.local.remove('kv:gone')
        expect(fake.data.has('kv:gone')).toBe(false)
    })

    it('relays onChanged events from the host to shim listeners', async () => {
        const listener = vi.fn()
        offscreenChrome.storage.onChanged.addListener(listener)

        fake.emitExternalChange('kv:accounts-store', '{"state":{}}')
        await vi.waitFor(() =>
            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    'kv:accounts-store': { newValue: '{"state":{}}' },
                }),
                'local',
            ),
        )
    })

    it('broadcasts only key names while the offscreen listener gets the current value', async () => {
        const listener = vi.fn()
        offscreenChrome.storage.onChanged.addListener(listener)
        const broadcast = vi.fn()
        fake.chrome.runtime.onMessage.addListener(message => {
            if (message?.scope === STORAGE_EVENT_SCOPE) broadcast(message)
        })
        const key = 'kv:wc1-session-key:fixture'
        fake.data.set(key, 'old-fixture-value')
        fake.emitExternalChange(key, 'new-fixture-value')

        await vi.waitFor(() =>
            expect(listener).toHaveBeenCalledWith(
                { [key]: { newValue: 'new-fixture-value' } },
                'local',
            ),
        )
        expect(broadcast).toHaveBeenCalledExactlyOnceWith({
            scope: STORAGE_EVENT_SCOPE,
            keys: [key],
        })
    })

    it('stops relaying to removed listeners', async () => {
        const listener = vi.fn()
        offscreenChrome.storage.onChanged.addListener(listener)
        offscreenChrome.storage.onChanged.removeListener(listener)

        fake.emitExternalChange('kv:x', 'y')
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(listener).not.toHaveBeenCalled()
    })

    it('does NOT relay session-area changes to the offscreen shim (raw vault master key lives there)', async () => {
        const listener = vi.fn()
        offscreenChrome.storage.onChanged.addListener(listener)

        fake.emitExternalChange('vault-master-key', 'super-secret', 'session')
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(listener).not.toHaveBeenCalled()
    })

    it('notifies offscreen listeners when a key is removed', async () => {
        const listener = vi.fn()
        offscreenChrome.storage.onChanged.addListener(listener)
        fake.data.set('kv:accounts-store', '{"state":{}}')

        await fake.chrome.storage.local.remove('kv:accounts-store')

        await vi.waitFor(() =>
            expect(listener).toHaveBeenCalledWith(
                { 'kv:accounts-store': {} },
                'local',
            ),
        )
    })

    it('updates and clears the offscreen key-value cache after external changes', async () => {
        vi.stubGlobal('chrome', offscreenChrome)
        try {
            const key = 'accounts-store'
            fake.data.set(`kv:${key}`, 'initial-fixture')
            const storage = new ChromeKeyValueStorageService()
            await storage.hydrate()
            expect(storage.getItem(key)).toBe('initial-fixture')

            fake.emitExternalChange(`kv:${key}`, 'updated-fixture')
            await vi.waitFor(() =>
                expect(storage.getItem(key)).toBe('updated-fixture'),
            )

            await fake.chrome.storage.local.remove(`kv:${key}`)
            await vi.waitFor(() => expect(storage.getItem(key)).toBeNull())
        } finally {
            vi.unstubAllGlobals()
        }
    })

    it('refuses storage-proxy messages from a non-offscreen sender (content-script shape)', async () => {
        const response = await fake.chrome.runtime.sendMessage(
            { scope: STORAGE_PROXY_SCOPE, kind: 'get', keys: null },
            { url: 'https://dapp.example' },
        )
        expect(response).toEqual({ ok: false, error: 'untrusted sender' })
    })

    it('refuses storage-proxy messages from a trusted-but-wrong extension page (only offscreen.html is legitimate)', async () => {
        const response = await fake.chrome.runtime.sendMessage(
            { scope: STORAGE_PROXY_SCOPE, kind: 'get', keys: null },
            { url: 'chrome-extension://test-extension-id/popup.html' },
        )
        expect(response).toEqual({ ok: false, error: 'untrusted sender' })
    })

    it('offscreen shim rejects storage events from untrusted senders', async () => {
        const listener = vi.fn()
        offscreenChrome.storage.onChanged.addListener(listener)

        // The storage-event relay is a broadcast: it never answers, so Chrome
        // closes the port on the sender. That rejection is the expected
        // condition here — the assertion is that the untrusted event never
        // reached the offscreen shim's listener.
        await fake.chrome.runtime
            .sendMessage(
                {
                    scope: STORAGE_EVENT_SCOPE,
                    keys: ['kv:x'],
                },
                { url: 'https://dapp.example' },
            )
            .catch(() => undefined)
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(listener).not.toHaveBeenCalled()
    })
})
