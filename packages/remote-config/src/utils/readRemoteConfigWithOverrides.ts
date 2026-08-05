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

import type { RemoteConfigService } from '@perawallet/wallet-extension-platform'

/**
 * Layers dev-only persisted overrides (set via the Feature Flags screen) on
 * top of the real remote config service. Extracted as a plain function, not
 * a hook, so non-component code (e.g. useAppBootstrap's effect) can apply
 * the same overrides the hook-based `useRemoteConfig()` does — without this,
 * flipping a flag in the dev screen would have no effect until the override
 * layer and the raw service converged on their own, which they never do.
 */
export const readRemoteConfigWithOverrides = (
    remoteConfigService: RemoteConfigService,
    configOverrides: Record<string, string | boolean | number>,
): RemoteConfigService => ({
    initializeRemoteConfig: () => remoteConfigService.initializeRemoteConfig(),
    getStringValue: (key, fallback) => {
        const override = configOverrides[key]
        if (override !== undefined && typeof override === 'string') {
            return override
        }
        return remoteConfigService.getStringValue(key, fallback)
    },
    getBooleanValue: (key, fallback) => {
        const override = configOverrides[key]
        if (override !== undefined && typeof override === 'boolean') {
            return override
        }
        return remoteConfigService.getBooleanValue(key, fallback)
    },
    getNumberValue: (key, fallback) => {
        const override = configOverrides[key]
        if (override !== undefined && typeof override === 'number') {
            return override
        }
        return remoteConfigService.getNumberValue(key, fallback)
    },
})
