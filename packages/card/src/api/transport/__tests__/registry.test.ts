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

import { describe, it, expect, afterEach, vi } from 'vitest'

vi.mock('ky', () => ({ isHTTPError: () => false }))
vi.mock('../baanx-client', () => ({ baanxDirectRequest: vi.fn() }))
vi.mock('@perawallet/wallet-core-shared', () => ({ queryClient: vi.fn() }))
// default-transport pulls the integrity-token reader for proxy headers; stub
// it so the app-integrity store (and its shared/registerStore import) stays
// out of this registry-focused test.
vi.mock('@perawallet/wallet-core-app-integrity', () => ({
    getValidIntegrityToken: () => null,
}))

import {
    getCardTransport,
    setCardTransport,
    resetCardTransport,
} from '../registry'
import { defaultTransport } from '../default-transport'

describe('card transport registry', () => {
    afterEach(() => resetCardTransport())

    it('defaults to the default transport', () => {
        expect(getCardTransport()).toBe(defaultTransport)
    })

    it('swaps the active transport and resets back to the default', () => {
        const fake = { request: vi.fn() }

        setCardTransport(fake)
        expect(getCardTransport()).toBe(fake)

        resetCardTransport()
        expect(getCardTransport()).toBe(defaultTransport)
    })
})
