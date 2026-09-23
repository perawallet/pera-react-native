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
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@perawallet/wallet-core-shared'
import type { PasskeyBackupPayload } from '../../models'
import { unwiredPasskeyImportFn } from '../types'

const passkey: PasskeyBackupPayload = {
    credentialId: 'Y3JlZC1pZA==',
    origin: 'webauthn.io',
    identity: 'alice',
    counter: 0,
    publicKeySpkiDer: 'cHVi',
    seedAddress: 'SEEDADDRESS',
    createdAt: 1,
}

describe('unwiredPasskeyImportFn', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('warns naming how many credentials were dropped when given a non-empty list', async () => {
        const warn = vi.spyOn(logger, 'warn')

        const summary = await unwiredPasskeyImportFn([passkey, passkey])

        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('dropped'),
            expect.objectContaining({ count: 2 }),
        )
        expect(summary).toEqual({ imported: 0, skipped: [], failed: [] })
    })

    it('does not warn for an empty list', async () => {
        const warn = vi.spyOn(logger, 'warn')

        const summary = await unwiredPasskeyImportFn([])

        expect(warn).not.toHaveBeenCalled()
        expect(summary).toEqual({ imported: 0, skipped: [], failed: [] })
    })
})

describe('unwiredPasskeyListFn', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('warns once per session across repeated calls, not once per call', async () => {
        // The warn-once guard is module-level state, so a fresh module
        // registry (and a logger pulled from that same registry) is the only
        // way to start from "never warned" without depending on test order.
        vi.resetModules()
        const { logger: freshLogger } =
            await import('@perawallet/wallet-core-shared')
        const { unwiredPasskeyListFn: freshUnwiredPasskeyListFn } =
            await import('../types')
        const warn = vi.spyOn(freshLogger, 'warn')

        const first = await freshUnwiredPasskeyListFn()
        const second = await freshUnwiredPasskeyListFn()

        expect(first).toEqual([])
        expect(second).toEqual([])
        expect(warn).toHaveBeenCalledTimes(1)
    })
})
