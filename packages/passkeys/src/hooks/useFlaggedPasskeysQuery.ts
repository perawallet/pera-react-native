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

import { useQuery } from '@tanstack/react-query'
import { keystoreSubtle } from '@perawallet/wallet-extension-provider'
import type { Passkey } from '../models/passkey'
import { readFlaggedPasskeyCredentials } from '../native/readFlaggedPasskeyCredentials'
import { passkeysQueryKeyRoot } from './usePasskeysQuery'

export type UseFlaggedPasskeysQueryResult = {
    flaggedPasskeys: Passkey[]
    /**
     * True only once a read has resolved having examined every record. False
     * while pending, after a rejection, or after an incomplete scan; an empty
     * `flaggedPasskeys` means "none flagged" only when this is true.
     */
    isComplete: boolean
}

const NO_FLAGGED_PASSKEYS: Passkey[] = []

// Built from the shared root because `useRemovePasskeyMutation` invalidates
// that root and TanStack matches by prefix — a key outside it would leave the
// banner listing a credential the user just deleted.
const flaggedPasskeysQueryKey = [
    ...passkeysQueryKeyRoot,
    'needs-migration',
] as const

/**
 * Passkeys still carrying a `needs-migration` marker on the flat, bare-id
 * provider records, where it survives once `repairs/0002` has removed the
 * `k/` record that held it.
 */
export const useFlaggedPasskeysQuery = (): UseFlaggedPasskeysQueryResult => {
    const query = useQuery({
        queryKey: flaggedPasskeysQueryKey,
        queryFn: () =>
            readFlaggedPasskeyCredentials({ subtle: keystoreSubtle }),
        staleTime: 30_000,
    })

    return {
        flaggedPasskeys: query.data?.flagged ?? NO_FLAGGED_PASSKEYS,
        // `isSuccess` alone is not enough: the read resolves on every failure
        // it can catch, so its own `isComplete` is the only thing separating
        // "nothing is flagged" from "nothing could be read", and treating the
        // second as the first is the one wrong answer that is irreversible.
        isComplete: query.isSuccess && query.data.isComplete,
    }
}
