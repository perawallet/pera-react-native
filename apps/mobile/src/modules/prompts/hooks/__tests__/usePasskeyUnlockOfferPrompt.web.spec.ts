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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    isPasskeyUnlockSupported: vi.fn<() => Promise<boolean>>(),
    isPasskeyUnlockEnabled: vi.fn<() => Promise<boolean>>(),
    hasRecentPasswordAuth: vi.fn<() => Promise<boolean>>(),
}))

vi.mock('@perawallet/wallet-extension-keystore-chrome', () => ({
    isPasskeyUnlockSupported: mocks.isPasskeyUnlockSupported,
    isPasskeyUnlockEnabled: mocks.isPasskeyUnlockEnabled,
    hasRecentPasswordAuth: mocks.hasRecentPasswordAuth,
}))

import { usePasskeyUnlockOfferPrompt } from '../usePasskeyUnlockOfferPrompt.web'

type Probes = { supported: boolean; enabled: boolean; recent: boolean }

const setProbes = ({ supported, enabled, recent }: Probes): void => {
    mocks.isPasskeyUnlockSupported.mockResolvedValue(supported)
    mocks.isPasskeyUnlockEnabled.mockResolvedValue(enabled)
    mocks.hasRecentPasswordAuth.mockResolvedValue(recent)
}

describe('usePasskeyUnlockOfferPrompt (web)', () => {
    beforeEach(() => {
        setProbes({ supported: true, enabled: false, recent: true })
    })

    it('is not due before the probes resolve', () => {
        const { result } = renderHook(() => usePasskeyUnlockOfferPrompt())

        expect(result.current.isDue).toBe(false)
    })

    it('is due when passkeys are supported, not enabled, and a password was proven recently', async () => {
        const { result } = renderHook(() => usePasskeyUnlockOfferPrompt())
        await act(async () => {})

        expect(result.current.isDue).toBe(true)
    })

    it.each([
        ['unsupported', { supported: false, enabled: false, recent: true }],
        ['already enabled', { supported: true, enabled: true, recent: true }],
        [
            'no recent password',
            { supported: true, enabled: false, recent: false },
        ],
    ])('is not due when %s', async (_name, probes) => {
        setProbes(probes)

        const { result } = renderHook(() => usePasskeyUnlockOfferPrompt())
        await act(async () => {})

        expect(result.current.isDue).toBe(false)
    })
})
