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

import { useCallback, useState } from 'react'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useCollectiblePreferencesStore } from '@perawallet/wallet-core-assets'
import { useCapabilityCheck } from '@hooks/useCapability'
import { useNftHoldingSources } from '../../hooks/useNftHoldingSources'

type UseNftFilterContentResult = {
    /** Only a chain with opt-in has opted-in-but-not-held collectibles to show. */
    canShowOptedIn: boolean
    showOptedIn: boolean
    showWatchAccounts: boolean
    handleToggleOptedIn: () => void
    handleToggleWatchAccounts: () => void
    commitChanges: () => void
}

export const useNftFilterContent = (): UseNftFilterContentResult => {
    const sources = useNftHoldingSources(useSelectedAccount())
    const checkCapability = useCapabilityCheck()
    const canShowOptedIn = sources.some(({ scope: { chainId } }) =>
        checkCapability({ chain: { chainId, capability: 'manageAssets' } }),
    )
    const showOptedIn = useCollectiblePreferencesStore(
        state => state.showOptedIn,
    )
    const showWatchAccounts = useCollectiblePreferencesStore(
        state => state.showWatchAccounts,
    )
    const setShowOptedIn = useCollectiblePreferencesStore(
        state => state.setShowOptedIn,
    )
    const setShowWatchAccounts = useCollectiblePreferencesStore(
        state => state.setShowWatchAccounts,
    )

    const [draftShowOptedIn, setDraftShowOptedIn] = useState(showOptedIn)
    const [draftShowWatchAccounts, setDraftShowWatchAccounts] =
        useState(showWatchAccounts)

    const handleToggleOptedIn = useCallback(() => {
        setDraftShowOptedIn(prev => !prev)
    }, [])

    const handleToggleWatchAccounts = useCallback(() => {
        setDraftShowWatchAccounts(prev => !prev)
    }, [])

    const commitChanges = useCallback(() => {
        setShowOptedIn(draftShowOptedIn)
        setShowWatchAccounts(draftShowWatchAccounts)
    }, [
        draftShowOptedIn,
        draftShowWatchAccounts,
        setShowOptedIn,
        setShowWatchAccounts,
    ])

    return {
        canShowOptedIn,
        showOptedIn: draftShowOptedIn,
        showWatchAccounts: draftShowWatchAccounts,
        handleToggleOptedIn,
        handleToggleWatchAccounts,
        commitChanges,
    }
}
