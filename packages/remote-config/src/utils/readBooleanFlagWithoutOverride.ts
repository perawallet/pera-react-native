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

import { getProvider } from '@perawallet/wallet-extension-provider'
import { readBooleanFlagBuildDefault } from './readBooleanFlagBuildDefault'

/**
 * The value the app reads for a boolean flag with no developer override. Goes
 * through the raw service, as a reader does, because the Firebase and Chrome
 * services differ on when the fetched value beats the fallback.
 */
export const readBooleanFlagWithoutOverride = (key: string): boolean =>
    getProvider().remoteConfig.getBooleanValue(
        key,
        readBooleanFlagBuildDefault(key),
    )
