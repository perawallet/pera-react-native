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

import { parseDeeplink as parsePackageDeeplink } from '@perawallet/wallet-core-deeplinks'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { parseDevE2eFixtureUri } from './dev-e2e-fixture-parser'
import { parseDevLocaleTourUri } from './dev-locale-tour-parser'
import { parsePeraWebImportLink } from './pera-web-import-parser'
import type { AppDeeplink } from './types'

// The first three own formats the package cannot decode (the web-import payload
// needs backup, and the dev tags must never reach a shared module). None of them
// matches anything the package claims earlier, so running them first changes
// no result.
export const parseDeeplink = (url: string): Nullable<AppDeeplink> =>
    parsePeraWebImportLink(url) ??
    parseDevLocaleTourUri(url) ??
    parseDevE2eFixtureUri(url) ??
    parsePackageDeeplink(url)
