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

export type AddressName = {
    /** The name, e.g. "alice.algo" or "alice.eth" */
    name: string
    /** The name service source, e.g. "nfd" */
    source: string
    /** Avatar URL, empty when the service has none */
    image: string
}

export type AddressNameResult = {
    address: string
    name: Nullable<AddressName>
}

/** Which name service names the addresses of a chain. */
export type NameServiceId = 'nfd' | 'ens'

export type NameSearchResult = {
    name: string
    address: string
    service: {
        name: string
        logo: string
    }
}

/**
 * How a name's backend-asserted address stands against the chain's own record
 * of the name. `unavailable` is a failed lookup, not a verdict: the caller
 * decides whether a send may go ahead without one.
 */
export type NameAddressVerification = 'verified' | 'mismatch' | 'unavailable'
