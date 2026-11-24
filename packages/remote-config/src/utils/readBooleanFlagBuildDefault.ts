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

import { isDebug, isProd, isStaging } from '@perawallet/wallet-core-config'
import {
    RemoteConfigKeys,
    remoteConfigDefaultsRegistry,
} from '@perawallet/wallet-extension-platform'

// The platform registry holds production values because extensions/platform
// can't import the build flags, so these keys need the variant read here.
const VARIANT_BOOLEAN_DEFAULTS: Partial<Record<string, () => boolean>> = {
    [RemoteConfigKeys.enable_pera_card]: () => isDebug || isStaging,
    [RemoteConfigKeys.enable_card_auto_funding]: () => isDebug || isStaging,
    [RemoteConfigKeys.enable_card_push_provisioning]: () =>
        isDebug || isStaging,
    // Keyed on the backend variant, not debug: a debug bundle of the production
    // variant talks to the production backend, and every other variant talks to
    // staging, which serves v4.
    [RemoteConfigKeys.enable_device_registration_v4]: () => !isProd,
}

/**
 * What a boolean flag reads when Remote Config holds no fetched value and no
 * developer override applies. Readers of the variant-dependent keys pass it as
 * their fallback so the Feature Flags screen shows what the app actually uses;
 * every other reader's literal fallback matches its registry default.
 */
export const readBooleanFlagBuildDefault = (key: string): boolean =>
    VARIANT_BOOLEAN_DEFAULTS[key]?.() ??
    remoteConfigDefaultsRegistry.all()[key] === true
