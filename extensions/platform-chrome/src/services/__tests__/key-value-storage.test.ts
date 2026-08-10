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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createChromeFake, type ChromeFake } from '../../test-utils/chrome'
import { ChromeKeyValueStorageService } from '../key-value-storage'

describe('ChromeKeyValueStorageService', () => {
    let fake: ChromeFake
    let service: ChromeKeyValueStorageService

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
        service = new ChromeKeyValueStorageService()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('throws on read before hydrate()', () => {
        expect(() => service.getItem('foo')).toThrow(/hydrate/)
    })

    // The interface is synchronous, so the write is fire-and-forget. Swallowing
    // the rejection would leave the cache serving a value that never reached
    // disk — invisible until a restart.
    it('reports a failed write instead of swallowing it', async () => {
        await service.hydrate()
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {})
        vi.spyOn(fake.chrome.storage.local, 'set').mockRejectedValue(
            new Error('QUOTA_BYTES quota exceeded'),
        )

        service.setItem('foo', 'super-secret-value')
        await vi.waitFor(() => expect(consoleError).toHaveBeenCalled())

        const logged = JSON.stringify(consoleError.mock.calls)
        expect(logged).toContain('kv:foo')
        // The persisted query cache lives under this prefix; values must never
        // reach logs or telemetry.
        expect(logged).not.toContain('super-secret-value')
    })

    it('reports a failed delete instead of swallowing it', async () => {
        await service.hydrate()
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {})
        vi.spyOn(fake.chrome.storage.local, 'remove').mockRejectedValue(
            new Error('storage unavailable'),
        )

        service.removeItem('foo')
        await vi.waitFor(() => expect(consoleError).toHaveBeenCalled())

        expect(JSON.stringify(consoleError.mock.calls)).toContain('kv:foo')
    })

    it('round-trips items synchronously after hydrate', async () => {
        await service.hydrate()
        service.setItem('foo', 'bar')
        expect(service.getItem('foo')).toBe('bar')
        expect(service.getItem('missing')).toBeNull()
    })

    it('write-throughs to chrome.storage.local under the kv: prefix', async () => {
        await service.hydrate()
        service.setItem('foo', 'bar')
        expect(fake.data.get('kv:foo')).toBe('bar')
        service.removeItem('foo')
        expect(fake.data.has('kv:foo')).toBe(false)
        expect(service.getItem('foo')).toBeNull()
    })

    it('hydrates existing kv: entries and ignores foreign keys', async () => {
        fake.data.set('kv:existing', 'value')
        fake.data.set('device:installation-id', 'not-kv')
        await service.hydrate()
        expect(service.getItem('existing')).toBe('value')
        expect(service.getAllKeys()).toEqual(['existing'])
    })

    it('applies changes from other extension contexts via onChanged', async () => {
        await service.hydrate()
        fake.emitExternalChange('kv:remote', 'from-elsewhere')
        expect(service.getItem('remote')).toBe('from-elsewhere')
    })

    it('serializes and parses JSON values', async () => {
        await service.hydrate()
        service.setJSON('obj', { a: 1 })
        expect(service.getJSON<{ a: number }>('obj')).toEqual({ a: 1 })
        expect(service.getJSON('missing')).toBeNull()
    })

    it('returns null for corrupt JSON values (RN driver parity)', async () => {
        await service.hydrate()
        service.setItem('corrupt', 'not-json{')
        expect(service.getJSON('corrupt')).toBeNull()
    })

    it('hydrate() is idempotent and never double-registers the listener', async () => {
        await service.hydrate()
        await service.hydrate()
        fake.emitExternalChange('kv:once', 'v1')
        expect(service.getItem('once')).toBe('v1')
        service.setItem('counted', 'v2')
        expect(service.getAllKeys().sort()).toEqual(['counted', 'once'])
    })
})
