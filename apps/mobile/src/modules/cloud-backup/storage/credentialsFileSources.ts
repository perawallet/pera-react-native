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
import { isAndroid, isIOS } from '@utils/platform'

import type { CredentialsFileSource } from './types'

// Neither the file picker nor either cloud SDK ships outside the two mobile
// builds, so anywhere else offers nothing rather than a row that throws the
// moment it is tapped. The extension gets its own twin.
//
// Which cloud drives exist is the platform's answer, since it owns both SDKs.
// Resolved once and kept: neither the OS nor the linked SDKs change at runtime,
// and callers memoize on this array's identity. Not at module scope, because
// the provider isn't wired yet when this module is first imported.
let resolved: CredentialsFileSource[] | null = null

const sources = (): CredentialsFileSource[] =>
    (resolved ??=
        isIOS() || isAndroid()
            ? ['device', ...getProvider().cloudFileStorage.getAvailableStores()]
            : [])

export const getCredentialsFileSaveSources = sources

export const getCredentialsFileReadSources = sources
