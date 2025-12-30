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

import { container } from 'tsyringe'
import type { RemoteConfigService } from '../models'
import { useRemoteConfigOverrides } from './useRemoteConfigOverrides'

export const RemoteConfigServiceContainerKey = 'RemoteConfigService'

export const useRemoteConfigService = () => {
    const configOverrides = useRemoteConfigOverrides()

    const remoteConfigService = container.resolve<RemoteConfigService>(
        RemoteConfigServiceContainerKey,
    )

    const wrapperService: RemoteConfigService = {
        initializeRemoteConfig: () =>
            remoteConfigService.initializeRemoteConfig(),
        getStringValue: (key, fallback) => {
            const override = configOverrides.configOverrides[key]
            if (override !== undefined && typeof override === 'string') {
                return override
            }
            return remoteConfigService.getStringValue(key, fallback)
        },
        getBooleanValue: (key, fallback) => {
            const override = configOverrides.configOverrides[key]
            if (override !== undefined && typeof override === 'boolean') {
                return override
            }
            return remoteConfigService.getBooleanValue(key, fallback)
        },
        getNumberValue: (key, fallback) => {
            const override = configOverrides.configOverrides[key]
            if (override !== undefined && typeof override === 'number') {
                return override
            }
            return remoteConfigService.getNumberValue(key, fallback)
        },
    }
    return wrapperService
}
