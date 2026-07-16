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

export type NfdName = {
    /** The NFD name, e.g. "alice.algo" */
    name: string
    /** The name service source, e.g. "nfd" */
    source: string
    /** Avatar/image URL for the NFD */
    image: string
}

export type NfdBulkResult = {
    address: string
    name: Nullable<NfdName>
}

export type NfdSearchResult = {
    name: string
    address: string
    service: {
        name: string
        logo: string
    }
}
