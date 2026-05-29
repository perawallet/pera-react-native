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

import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    RemoteConfigKeys,
    useRemoteConfig,
} from '@perawallet/wallet-core-remote-config'
import { useLiquidAuthEnabled } from '../useLiquidAuthEnabled'

vi.mock('@perawallet/wallet-core-remote-config', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-remote-config')
        >()
    return {
        ...actual,
        useRemoteConfig: vi.fn(),
    }
})

describe('useLiquidAuthEnabled', () => {
    it('returns true when the remote config flag is enabled', () => {
        vi.mocked(useRemoteConfig).mockReturnValue({
            initializeRemoteConfig: vi.fn(),
            getStringValue: vi.fn(),
            getNumberValue: vi.fn(),
            getBooleanValue: vi.fn((key, _default) =>
                key === RemoteConfigKeys.enable_liquid_auth
                    ? true
                    : Boolean(_default),
            ),
        })

        const { result } = renderHook(() => useLiquidAuthEnabled())

        expect(result.current).toBe(true)
    })

    it('returns false when the remote config flag is disabled', () => {
        vi.mocked(useRemoteConfig).mockReturnValue({
            initializeRemoteConfig: vi.fn(),
            getStringValue: vi.fn(),
            getNumberValue: vi.fn(),
            getBooleanValue: vi.fn(() => false),
        })

        const { result } = renderHook(() => useLiquidAuthEnabled())

        expect(result.current).toBe(false)
    })
})
