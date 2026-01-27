/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useKMS } from '@perawallet/wallet-core-kms'
import { DataStoreRegistry } from '@perawallet/wallet-core-shared'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

// TODO: probably want to revoke device here so we stop sending push notifications
export const useDeleteAllData = () => {
    const { keys, deleteKey } = useKMS()
    const queryClient = useQueryClient()

    return useCallback(async () => {
        if (queryClient) {
            queryClient.removeQueries()
        }

        if (keys) {
            await keys.forEach(async k => {
                if (k.id) {
                    await deleteKey(k.id)
                }
            })
        }

        await DataStoreRegistry.clearAll()
    }, [queryClient, keys, deleteKey])
}
