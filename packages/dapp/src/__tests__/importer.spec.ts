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
import {
    clearLegacyDappPermissions,
    LEGACY_DAPP_PERMISSIONS_KEY,
} from '../importer'

const makeArea = (legacy?: unknown) => {
    const entries: Record<string, unknown> =
        legacy === undefined ? {} : { [LEGACY_DAPP_PERMISSIONS_KEY]: legacy }
    return {
        get: vi.fn(async (key: string) =>
            key in entries ? { [key]: entries[key] } : {},
        ),
        remove: vi.fn(async (key: string) => {
            delete entries[key]
        }),
    }
}

const legacy = {
    'https://dapp.example': {
        origin: 'https://dapp.example',
        addresses: ['AAAA'],
        grantedAt: 1_700_000_000_000,
    },
}

describe('clearLegacyDappPermissions', () => {
    it('leaves storage alone when the legacy key is absent', async () => {
        const area = makeArea()

        await clearLegacyDappPermissions(area)

        expect(area.remove).not.toHaveBeenCalled()
    })

    it('removes a legacy grant blob without returning any grants', async () => {
        const area = makeArea(legacy)

        await expect(clearLegacyDappPermissions(area)).resolves.toBeUndefined()

        expect(area.remove).toHaveBeenCalledWith(LEGACY_DAPP_PERMISSIONS_KEY)
        expect(await area.get(LEGACY_DAPP_PERMISSIONS_KEY)).toEqual({})
    })

    it('can retry cleanup when the earlier storage removal did not land', async () => {
        const area = makeArea(legacy)
        area.remove.mockResolvedValueOnce(undefined)

        await clearLegacyDappPermissions(area)
        await clearLegacyDappPermissions(area)

        expect(area.remove).toHaveBeenCalledTimes(2)
        expect(await area.get(LEGACY_DAPP_PERMISSIONS_KEY)).toEqual({})
    })
})
