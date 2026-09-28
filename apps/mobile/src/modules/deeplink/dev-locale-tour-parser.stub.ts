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

import type { Nullable } from '@perawallet/wallet-core-shared'

import type { AnyParsedDeeplink, DevLocaleTourDeeplink } from './types'

// Returning null here is what makes `perawallet://app/dev/locale-tour?...`
// fall through to the ordinary `perawallet://app/...` parser and resolve to a
// harmless HOME, exactly as it would for any other unrecognized path.
export const parseDevLocaleTourUri = (): Nullable<DevLocaleTourDeeplink> => null

export const isDevLocaleTourDeeplink = (
    _parsed: AnyParsedDeeplink,
): _parsed is DevLocaleTourDeeplink => false
