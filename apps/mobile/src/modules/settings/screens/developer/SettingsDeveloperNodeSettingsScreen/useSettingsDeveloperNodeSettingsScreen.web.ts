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

import { useState } from 'react'
import { getSyncService } from '@perawallet/wallet-core-background'
import { useNetwork, useNetworkStore } from '@perawallet/wallet-core-blockchain'
import type { Network } from '@perawallet/wallet-core-shared'

type UseSettingsDeveloperNodeSettingsScreenResult = {
    isMainnet: boolean
    isTestnet: boolean
    isSwitching: boolean
    switchTo: (network: Network) => Promise<void>
}

// Web/extension variant: no backend device registration (that's native-only
// push-notification plumbing, irrelevant and failure-prone here). Switching
// networks is just persisting the store and nudging the sync service.
export const useSettingsDeveloperNodeSettingsScreen =
    (): UseSettingsDeveloperNodeSettingsScreenResult => {
        const { network, isMainnet, isTestnet } = useNetwork()
        const [isSwitching, setIsSwitching] = useState(false)

        const switchTo = async (nextNetwork: Network): Promise<void> => {
            if (nextNetwork === network) {
                return
            }

            setIsSwitching(true)
            useNetworkStore.getState().setNetwork(nextNetwork)

            try {
                const syncService = getSyncService()
                syncService.invalidateQueries()
                syncService.restart()
            } catch {
                // SyncService not yet initialized
            }

            setIsSwitching(false)
        }

        return { isMainnet, isTestnet, isSwitching, switchTo }
    }
