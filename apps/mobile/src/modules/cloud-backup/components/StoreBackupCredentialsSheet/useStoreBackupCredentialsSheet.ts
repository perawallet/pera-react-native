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

import { useCallback } from 'react'
import { Platform } from 'react-native'
import { useBottomSheetResult } from '@modules/bottom-sheet'

export type StoreCredentialsDestination = 'local' | 'icloud' | 'googleDrive'

type UseStoreBackupCredentialsSheetResult = {
    destinations: StoreCredentialsDestination[]
    handleSelect: (destination: StoreCredentialsDestination) => void
}

// iCloud has no Android client, and the browser extension ships neither
// native SDK.
const DESTINATIONS_BY_OS: Partial<
    Record<typeof Platform.OS, StoreCredentialsDestination[]>
> = {
    ios: ['local', 'icloud', 'googleDrive'],
    android: ['local', 'googleDrive'],
}
const LOCAL_ONLY: StoreCredentialsDestination[] = ['local']

export const useStoreBackupCredentialsSheet =
    (): UseStoreBackupCredentialsSheetResult => {
        const { resolve } = useBottomSheetResult<StoreCredentialsDestination>()
        const destinations = DESTINATIONS_BY_OS[Platform.OS] ?? LOCAL_ONLY

        const handleSelect = useCallback(
            (destination: StoreCredentialsDestination) => resolve(destination),
            [resolve],
        )

        return { destinations, handleSelect }
    }
