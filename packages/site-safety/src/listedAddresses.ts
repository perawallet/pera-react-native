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

import { logger } from '@perawallet/wallet-core-shared'
import { toListedAddressKey } from './addresses'
import { findListedAddresses } from './db/repository'
import { whenPhishingListsSeeded } from './seed'
import { selectActiveGenerations, usePhishingListStore } from './store/store'

/** The `toListedAddressKey` keys of the given addresses that are on a list. */
export const findPhishingListedAddresses = async (
    addresses: readonly string[],
): Promise<string[]> => {
    if (addresses.length === 0) return []
    await whenPhishingListsSeeded()
    try {
        return await findListedAddresses({
            generations: selectActiveGenerations(
                usePhishingListStore.getState(),
            ),
            addresses: [...new Set(addresses.map(toListedAddressKey))],
        })
    } catch (error) {
        // Rethrown so the query retries; until one succeeds no address reads
        // as listed, and the look-alike check still runs.
        logger.warn('[site-safety] scam address lookup failed', { error })
        throw error
    }
}
