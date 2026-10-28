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

import { useEffect } from 'react'
import { onLocalStorageKeyChanged } from '@perawallet/wallet-core-browser-runtime'
import {
    PHISHING_LIST_STORE_NAME,
    usePhishingListStore,
} from '@perawallet/wallet-core-site-safety'

// The offscreen document writes the lists and their active copy; a UI context
// re-reads its pointer so a check never reads a copy that has been pruned.
export const usePhishingListRehydration = (): void => {
    useEffect(
        () =>
            onLocalStorageKeyChanged([`kv:${PHISHING_LIST_STORE_NAME}`], () => {
                void usePhishingListStore.persist.rehydrate()
            }),
        [],
    )
}
