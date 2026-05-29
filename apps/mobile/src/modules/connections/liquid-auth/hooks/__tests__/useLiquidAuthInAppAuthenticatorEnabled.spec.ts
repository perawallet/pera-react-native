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

import { renderHook } from '@testing-library/react'
import { useRemoteConfig } from '@perawallet/wallet-core-remote-config'
import { describe, expect, it, vi } from 'vitest'

import { useLiquidAuthInAppAuthenticatorEnabled } from '../useLiquidAuthInAppAuthenticatorEnabled'

vi.mock('@perawallet/wallet-core-remote-config', () => ({
    useRemoteConfig: vi.fn(),
}))

const mockUseRemoteConfig = vi.mocked(useRemoteConfig)

describe('useLiquidAuthInAppAuthenticatorEnabled', () => {
    it('returns true when the remote config flag is enabled', () => {
        mockUseRemoteConfig.mockReturnValue({
            getBooleanValue: vi.fn().mockReturnValue(true),
        } as unknown as ReturnType<typeof useRemoteConfig>)

        const { result } = renderHook(() =>
            useLiquidAuthInAppAuthenticatorEnabled(),
        )

        expect(result.current).toBe(true)
    })

    it('returns false when the remote config flag is disabled', () => {
        mockUseRemoteConfig.mockReturnValue({
            getBooleanValue: vi.fn().mockReturnValue(false),
        } as unknown as ReturnType<typeof useRemoteConfig>)

        const { result } = renderHook(() =>
            useLiquidAuthInAppAuthenticatorEnabled(),
        )

        expect(result.current).toBe(false)
    })
})
