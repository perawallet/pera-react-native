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
import {
    useProvenPasskeysStore,
    type BackupPasskey,
} from '@perawallet/wallet-core-backup'
import { useListPasskeysForBackup } from './useListPasskeysForBackup'

export type UseProvenPasskeysQueryResult = {
    passkeys: BackupPasskey[]
    isLoading: boolean
    /** False while the list cannot be trusted: the sweep is still running, or
     *  it failed and no earlier sync tick left a result behind. An empty list
     *  read as fact renders as "0 passkeys, all in sync", which is the wrong
     *  direction for a backup screen to guess in. */
    isResolved: boolean
}

/** Proving a credential costs a PBKDF2 per owning seed, so the sweep runs here
 *  and the store is the read side: a sync tick running the same sweep in the
 *  background refreshes an open screen without a refetch. */
export const useProvenPasskeysQuery = (): UseProvenPasskeysQueryResult => {
    const listPasskeys = useListPasskeysForBackup()
    const provenPasskeys = useProvenPasskeysStore(state => state.provenPasskeys)

    const { isLoading, isError } = useQuery({
        queryKey: ['cloud-backup', 'proven-passkeys'],
        queryFn: listPasskeys,
    })

    return {
        passkeys: provenPasskeys,
        isLoading,
        isResolved: provenPasskeys.length > 0 || (!isLoading && !isError),
    }
}
