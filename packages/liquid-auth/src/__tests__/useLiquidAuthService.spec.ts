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

import { describe, it, expect, vi, afterEach } from 'vitest'

const { getProviderMock } = vi.hoisted(() => ({ getProviderMock: vi.fn() }))
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => getProviderMock(),
}))

import { useLiquidAuthService } from '../hooks/useLiquidAuthService'
import { LiquidAuthServiceUnavailableError } from '../errors'

describe('useLiquidAuthService', () => {
    afterEach(() => getProviderMock.mockReset())

    it('returns the liquidAuth service when present', () => {
        const liquidAuth = { createSignalClient: vi.fn(), runCeremony: vi.fn() }
        getProviderMock.mockReturnValue({ liquidAuth })
        expect(useLiquidAuthService()).toBe(liquidAuth)
    })

    it('throws when the extension is not composed', () => {
        getProviderMock.mockReturnValue({})
        expect(() => useLiquidAuthService()).toThrow(
            LiquidAuthServiceUnavailableError,
        )
    })
})
