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

import { describe, test, expect, vi } from 'vitest'
import { container } from 'tsyringe'
import {
    RemoteConfigServiceContainerKey,
    useRemoteConfigService,
    type RemoteConfigService,
} from '@services/remote-config'

describe('services/remote-config/platform-service', () => {
    test('useRemoteConfigService resolves the registered RemoteConfigService from the container', () => {
        const dummy: RemoteConfigService = {
            initializeRemoteConfig: vi.fn(),
            getStringValue: vi.fn(() => 'value'),
            getBooleanValue: vi.fn(() => true),
            getNumberValue: vi.fn(() => 42),
        }

        container.register(RemoteConfigServiceContainerKey, { useValue: dummy })

        const svc = useRemoteConfigService()
        expect(svc).toBe(dummy)

        svc.initializeRemoteConfig()
        expect(dummy.initializeRemoteConfig).toHaveBeenCalledTimes(1)
    })
})
