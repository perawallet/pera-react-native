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

import { useSendFunds } from '@modules/transactions/hooks'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useEffect, useState } from 'react'
import { useSendDestinationRouter } from '../useSendDestinationRouter'

export const useSelectDestinationScreen = () => {
    const { destination } = useSendFunds()
    const selectedAccount = useSelectedAccount()
    const {
        selectedAsset,
        resolveDestination,
        isResolvingDestination,
        isReady,
        isAssetUnavailable,
    } = useSendDestinationRouter()

    // A value-bearing deeplink (algorand://<address>?amount=…) prefills the
    // destination before this screen mounts (it's the initial route for a
    // pure-NFT transfer). Seed the auto-advance flag from that initial value
    // so the picker never flashes while we route through.
    const [isAutoAdvancing, setIsAutoAdvancing] = useState(() => !!destination)

    // When the destination arrived via deeplink, use it directly instead of
    // making the user re-pick a receiver. Runs once, and only once the routing
    // inputs are ready — going back from a later screen leaves `isAutoAdvancing`
    // false so the picker shows.
    useEffect(() => {
        if (!isAutoAdvancing) return
        // No prefill, or the asset can't be resolved — stop auto-advancing and
        // let the normal picker / error EmptyView render instead of spinning.
        if (!destination || isAssetUnavailable) {
            setIsAutoAdvancing(false)
            return
        }
        // Wait for the asset + balances so the opt-in routing isn't decided
        // against an empty (still-loading) balances map.
        if (!isReady) return

        setIsAutoAdvancing(false)
        resolveDestination(destination)
    }, [
        isAutoAdvancing,
        destination,
        isReady,
        isAssetUnavailable,
        resolveDestination,
    ])

    return {
        selectedAsset,
        selectedAccount,
        handleSelected: resolveDestination,
        isCheckingExternalOptIn: isResolvingDestination,
        isAutoAdvancing,
    }
}
