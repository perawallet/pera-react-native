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

import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@perawallet/wallet-core-config', () => ({
    config: { appBuildNumber: '', appEnvironment: 'production' },
}))

import { installOffscreenManifestShim } from '../manifest-shim'
import { ChromeDeviceInfoService } from '../services/device'

const STORE_MANIFEST = {
    manifest_version: 3,
    name: 'Pera Wallet',
    version: '8.0.0.1234',
    update_url: 'https://clients2.google.com/service/update2/crx',
}

// The offscreen document's chrome: runtime messaging, no getManifest.
const offscreenChrome = (): typeof chrome =>
    ({
        runtime: { id: 'test-extension-id' },
    }) as unknown as typeof chrome

const manifestResponse = (body: unknown): Promise<Response> =>
    Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))

describe('installOffscreenManifestShim', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('lets the device service tell a store install apart in the offscreen document', async () => {
        const chromeLike = offscreenChrome()
        vi.stubGlobal('chrome', chromeLike)

        await installOffscreenManifestShim(chromeLike, () =>
            manifestResponse(STORE_MANIFEST),
        )

        const service = new ChromeDeviceInfoService()
        expect(service.isStoreBuild()).toBe(true)
        expect(service.getAppVersion()).toBe('8.0.0')
    })

    it('leaves a context that has getManifest alone', async () => {
        const getManifest = vi.fn(() => STORE_MANIFEST)
        const chromeLike = {
            runtime: { getManifest },
        } as unknown as typeof chrome
        const readManifest = vi.fn(() => manifestResponse({}))

        await installOffscreenManifestShim(chromeLike, readManifest)

        expect(readManifest).not.toHaveBeenCalled()
        expect(chromeLike.runtime.getManifest).toBe(getManifest)
    })

    it('fails the boot when the manifest answers with an error', async () => {
        const chromeLike = offscreenChrome()

        await expect(
            installOffscreenManifestShim(chromeLike, () =>
                Promise.resolve(new Response('', { status: 404 })),
            ),
        ).rejects.toThrow('manifest.json answered 404')

        expect(chromeLike.runtime.getManifest).toBeUndefined()
    })

    it('fails the boot when the manifest cannot be fetched', async () => {
        const chromeLike = offscreenChrome()
        const unreachable = new TypeError('Failed to fetch')

        await expect(
            installOffscreenManifestShim(chromeLike, () =>
                Promise.reject(unreachable),
            ),
        ).rejects.toBe(unreachable)

        expect(chromeLike.runtime.getManifest).toBeUndefined()
    })
})
