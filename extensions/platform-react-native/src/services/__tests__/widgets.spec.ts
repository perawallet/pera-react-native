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
import { RNWidgetsService } from '../widgets'
import { PINNED_ROOT_SPKI_HASHES } from '../ssl-pinning/pins'

const nativeWidgetsMock = vi.hoisted(() => ({
    current: null as Record<string, ReturnType<typeof vi.fn>> | null,
}))

vi.mock('expo', () => ({
    requireOptionalNativeModule: (name: string) =>
        name === 'PeraWidgets' ? nativeWidgetsMock.current : null,
}))

const IMAGE = { key: '286018494', url: 'https://example.com/a.png' }

const createService = (isPinningEnabled = false) =>
    new RNWidgetsService({ getBooleanValue: () => isPinningEnabled })

describe('RNWidgetsService', () => {
    beforeEach(() => {
        nativeWidgetsMock.current = null
    })

    it('no-ops when the native module is absent', async () => {
        const service = createService()

        await expect(service.writeSnapshot('{}')).resolves.toBeUndefined()
        await expect(service.clearSnapshot()).resolves.toBeUndefined()
        await expect(service.syncImages([IMAGE])).resolves.toEqual([])
    })

    it('passes calls through to the native module', async () => {
        const native = {
            writeSnapshot: vi.fn().mockResolvedValue(undefined),
            clearSnapshot: vi.fn().mockResolvedValue(undefined),
            syncImages: vi.fn().mockResolvedValue(['286018494']),
        }
        nativeWidgetsMock.current = native
        const service = createService()

        await service.writeSnapshot('{"version":1}')
        await service.clearSnapshot()
        const cached = await service.syncImages([IMAGE])

        expect(native.writeSnapshot).toHaveBeenCalledWith('{"version":1}')
        expect(native.clearSnapshot).toHaveBeenCalledOnce()
        expect(native.syncImages).toHaveBeenCalledWith([IMAGE])
        expect(cached).toEqual(['286018494'])
    })

    it('swallows native errors and returns safe defaults', async () => {
        nativeWidgetsMock.current = {
            writeSnapshot: vi.fn().mockRejectedValue(new Error('boom')),
            clearSnapshot: vi.fn().mockRejectedValue(new Error('boom')),
            syncImages: vi.fn().mockRejectedValue(new Error('boom')),
        }
        const service = createService()

        await expect(service.writeSnapshot('{}')).resolves.toBeUndefined()
        await expect(service.clearSnapshot()).resolves.toBeUndefined()
        await expect(service.syncImages([IMAGE])).resolves.toEqual([])
    })

    it('reads and clears a scan the Control Center control requested', async () => {
        const consumePendingScan = vi.fn().mockResolvedValue(true)
        nativeWidgetsMock.current = { consumePendingScan }
        const service = createService()

        await expect(service.consumePendingScan()).resolves.toBe(true)
        expect(consumePendingScan).toHaveBeenCalledOnce()
    })

    it('reports no pending scan without the native module or when it throws', async () => {
        const service = createService()
        await expect(service.consumePendingScan()).resolves.toBe(false)

        nativeWidgetsMock.current = {
            consumePendingScan: vi.fn().mockRejectedValue(new Error('boom')),
        }
        await expect(service.consumePendingScan()).resolves.toBe(false)
    })

    it('forwards scan requests from the native module and stops on unsubscribe', () => {
        const remove = vi.fn()
        let emit: (() => void) | undefined
        nativeWidgetsMock.current = {
            addListener: vi.fn((_event: string, listener: () => void) => {
                emit = listener
                return { remove }
            }),
        }
        const listener = vi.fn()
        const service = createService()

        const unsubscribe = service.onScanRequested(listener)
        emit?.()
        unsubscribe()

        expect(nativeWidgetsMock.current.addListener).toHaveBeenCalledWith(
            'onScanRequested',
            expect.any(Function),
        )
        expect(listener).toHaveBeenCalledOnce()
        expect(remove).toHaveBeenCalledOnce()
    })

    it('returns a no-op unsubscribe without the native module', () => {
        const service = createService()

        expect(() => service.onScanRequested(vi.fn())()).not.toThrow()
    })

    it('shares the app pin set for a pinnable Pera host while pinning is on', () => {
        const service = createService(true)

        expect(
            service.backendPinning('https://mainnet.api.perawallet.app'),
        ).toEqual({
            publicKeyHashes: [...PINNED_ROOT_SPKI_HASHES],
            expiresAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T00:00:00Z$/),
        })
    })

    it('shares no pins while the Pera API pinning flag is off', () => {
        const service = createService(false)

        expect(
            service.backendPinning('https://mainnet.api.perawallet.app'),
        ).toBeNull()
    })

    it('shares no pins for a host the app never pins', () => {
        const service = createService(true)

        expect(service.backendPinning('https://evil-perawallet.app')).toBeNull()
        expect(service.backendPinning('not a url')).toBeNull()
    })
})
