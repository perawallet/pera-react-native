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

import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import { logger } from '@perawallet/wallet-core-shared'
import type { NfdBulkResult, NfdName, NfdSearchResult } from '../models'
import type {
    NfdBulkReadApiResponse,
    NfdNameApiResponse,
    NfdNamesListApiResponse,
    NfdSearchApiResponse,
} from './schema'

const transformNfdName = (response: NfdNameApiResponse): NfdName => ({
    name: response.name,
    source: response.source,
    image: response.image,
})

export const transformNfdNamesList = (
    response: NfdNamesListApiResponse,
): NfdName[] => response.results.map(transformNfdName)

export const transformBulkResults = (
    response: NfdBulkReadApiResponse,
): NfdBulkResult[] =>
    response.results.map(item => ({
        address: item.address,
        name: item.name ? transformNfdName(item.name) : null,
    }))

export const transformSearchResults = (
    response: NfdSearchApiResponse,
): NfdSearchResult[] =>
    response.results
        // A name search returns a backend-asserted address that can become a
        // send destination. The backend is semi-trusted, so a malformed/garbage
        // address must never reach the destination picker. This closes the
        // malformed-response case; a VALID attacker-supplied address still needs
        // on-chain registry verification, which is a follow-up.
        .filter(item => {
            if (isValidAlgorandAddress(item.address)) return true
            logger.warn('NFD search result dropped: invalid Algorand address', {
                name: item.name,
            })
            return false
        })
        .map(item => ({
            name: item.name,
            address: item.address,
            service: {
                name: item.service.name,
                logo: item.service.logo,
            },
        }))
