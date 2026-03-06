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

import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { useKMS } from '@perawallet/wallet-core-kms'
import { usePinCode } from '@perawallet/wallet-core-security'
import { logger } from '@perawallet/wallet-core-shared'
import { clearDataStores } from '@perawallet/wallet-extension-provider'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useDeleteDeviceMutation } from '@perawallet/wallet-extension-platform'

const ACCOUNTS_STORE_NAME = 'accounts-store'

export const clearAccountsStore = () => {
    useAccountsStore.getState().resetState()
    useAccountsStore.persist.clearStorage()
}

type UseDeleteAllDataResult = {
    deleteAllData: () => Promise<void>
}

export const useDeleteAllData = (): UseDeleteAllDataResult => {
    const { keys, deleteKey } = useKMS()
    const queryClient = useQueryClient()
    const { mutateAsync: deleteDevices } = useDeleteDeviceMutation()
    const { savePin } = usePinCode()

    const deleteAllData = useCallback(async () => {
        if (queryClient) {
            queryClient.removeQueries()
        }

        if (keys) {
            await Promise.allSettled(
                Array.from(keys.values()).map(async k => {
                    if (k.id) {
                        await deleteKey(k.id)
                    }
                }),
            )
        }

        try {
            await deleteDevices()
        } catch (e) {
            logger.error('Failed to delete devices', { error: e })
        }

        // Clear PIN and biometrics from secure storage
        await savePin(null)

        // Clear all stores except accounts — accounts store is cleared
        // separately after the success dialog so the navigation guard
        // doesn't redirect before the user sees the confirmation
        clearDataStores({ skip: [ACCOUNTS_STORE_NAME] })
    }, [queryClient, keys, deleteKey, savePin, deleteDevices])

    return { deleteAllData }
}
