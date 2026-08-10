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

import {
    describe,
    it,
    expect,
    afterEach,
    beforeEach,
    vi,
    type Mock,
} from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRemoteConfig } from '@perawallet/wallet-core-remote-config'
import { useIsCardPushProvisioningEnabled } from '../useIsCardPushProvisioningEnabled'

vi.mock('@perawallet/wallet-core-remote-config', () => ({
    useRemoteConfig: vi.fn(),
    RemoteConfigKeys: {
        enable_card_push_provisioning: 'enable_card_push_provisioning',
    },
}))

// Live getter so each test can flip the environment the hook reads.
const buildFlags = vi.hoisted(() => ({ appEnvironment: 'production' }))
vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        get appEnvironment() {
            return buildFlags.appEnvironment
        },
    },
}))

describe('useIsCardPushProvisioningEnabled', () => {
    const mockGetBooleanValue = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal('__DEV__', false)
        buildFlags.appEnvironment = 'production'
        ;(useRemoteConfig as Mock).mockReturnValue({
            getBooleanValue: mockGetBooleanValue,
        })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('queries the enable_card_push_provisioning flag', () => {
        mockGetBooleanValue.mockReturnValue(true)

        renderHook(() => useIsCardPushProvisioningEnabled())

        expect(mockGetBooleanValue).toHaveBeenCalledWith(
            'enable_card_push_provisioning',
            expect.any(Boolean),
        )
    })

    it('returns the remote value when set', () => {
        mockGetBooleanValue.mockReturnValue(true)
        const { result } = renderHook(() => useIsCardPushProvisioningEnabled())
        expect(result.current).toBe(true)

        mockGetBooleanValue.mockReturnValue(false)
        const { result: result2 } = renderHook(() =>
            useIsCardPushProvisioningEnabled(),
        )
        expect(result2.current).toBe(false)
    })

    it('falls back to enabled on dev builds when the flag is unset', () => {
        mockGetBooleanValue.mockImplementation(
            (_key: string, fallback?: boolean) => fallback ?? false,
        )
        vi.stubGlobal('__DEV__', true)

        const { result } = renderHook(() => useIsCardPushProvisioningEnabled())

        expect(result.current).toBe(true)
    })

    it('falls back to enabled on staging builds when the flag is unset', () => {
        mockGetBooleanValue.mockImplementation(
            (_key: string, fallback?: boolean) => fallback ?? false,
        )
        buildFlags.appEnvironment = 'staging'

        const { result } = renderHook(() => useIsCardPushProvisioningEnabled())

        expect(result.current).toBe(true)
    })

    it('falls back to disabled on the signed prod release when the flag is unset', () => {
        mockGetBooleanValue.mockImplementation(
            (_key: string, fallback?: boolean) => fallback ?? false,
        )

        const { result } = renderHook(() => useIsCardPushProvisioningEnabled())

        expect(result.current).toBe(false)
    })
})
