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

import { describe, test, expect, vi, beforeEach, Mock } from 'vitest'
import { container } from 'tsyringe'
import {
    RemoteConfigServiceContainerKey,
    useRemoteConfigService,
} from '../index'
import { RemoteConfigKey, type RemoteConfigService } from '../../models'

vi.mock('../../store', () => ({
    useRemoteConfigStore: vi.fn(selector => {
        // Default mock state, can be overridden in tests if needed via mockImplementation
        return selector({
            configOverrides: {},
            setConfigOverride: vi.fn(),
        })
    }),
}))

// We need to properly mock the hook stack
vi.mock('../useRemoteConfigOverrides', () => ({
    useRemoteConfigOverrides: vi.fn(() => ({
        configOverrides: {},
        setConfigOverride: vi.fn(),
    })),
}))

import { useRemoteConfigOverrides } from '../useRemoteConfigOverrides'

describe('services/remote-config/platform-service', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('useRemoteConfigService resolves the registered RemoteConfigService from the container', () => {
        const dummy: RemoteConfigService = {
            initializeRemoteConfig: vi.fn(),
            getStringValue: vi.fn(() => 'value'),
            getBooleanValue: vi.fn(() => true),
            getNumberValue: vi.fn(() => 42),
        }

        container.register(RemoteConfigServiceContainerKey, { useValue: dummy })

        const svc = useRemoteConfigService()

        // It returns a wrapper now, not the exact instance
        expect(svc).not.toBe(dummy)

        svc.initializeRemoteConfig()
        expect(dummy.initializeRemoteConfig).toHaveBeenCalledTimes(1)

        expect(svc.getStringValue('key' as RemoteConfigKey)).toBe('value')
        expect(svc.getBooleanValue('key' as RemoteConfigKey)).toBe(true)
        expect(svc.getNumberValue('key' as RemoteConfigKey)).toBe(42)
    })

    test('should use override values when present', () => {
        const dummy: RemoteConfigService = {
            initializeRemoteConfig: vi.fn(),
            getStringValue: vi.fn(() => 'original'),
            getBooleanValue: vi.fn(() => false),
            getNumberValue: vi.fn(() => 0),
        }

        container.register(RemoteConfigServiceContainerKey, { useValue: dummy })

        // Mock overrides
        const mockOverrides = {
            string_key: 'overridden',
            bool_key: true,
            number_key: 99,
        }

        ;(useRemoteConfigOverrides as Mock).mockReturnValue({
            configOverrides: mockOverrides,
            setConfigOverride: vi.fn(),
        })

        const svc = useRemoteConfigService()

        expect(svc.getStringValue('string_key' as RemoteConfigKey)).toBe(
            'overridden',
        )
        expect(svc.getBooleanValue('bool_key' as RemoteConfigKey)).toBe(true)
        expect(svc.getNumberValue('number_key' as RemoteConfigKey)).toBe(99)

        // Should fallback to original if no override
        expect(svc.getStringValue('other_key' as RemoteConfigKey)).toBe(
            'original',
        )
    })
})
