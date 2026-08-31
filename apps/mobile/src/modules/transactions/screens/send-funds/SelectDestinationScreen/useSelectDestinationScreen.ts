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
import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import { useSendDestinationRouter } from '../useSendDestinationRouter'

export const useSelectDestinationScreen = () => {
    const { destination, onFinished } = useSendFunds()
    const navigation = useNavigation()
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

    // The send sheet deliberately disables swipe- and backdrop-dismissal, so
    // every screen that can be the flow's *initial* route must offer its own
    // way out. A pure-NFT transfer skips the amount step, leaving this screen
    // as the stack root with nothing beneath it — `canGoBack()` is false and
    // the default header back button never renders, which is exactly what
    // stranded the sheet. Surface a close that tears the flow down; when this
    // screen was pushed instead (canGoBack), the back button already handles it.
    const canClose = !navigation.canGoBack()
    const handleClose = useCallback(() => onFinished?.(), [onFinished])

    return {
        selectedAsset,
        selectedAccount,
        handleSelected: resolveDestination,
        isCheckingExternalOptIn: isResolvingDestination,
        isAutoAdvancing,
        canClose,
        onClose: handleClose,
    }
}
