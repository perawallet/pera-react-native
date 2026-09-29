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
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { verifyNameAddress } from '@perawallet/wallet-core-nfd'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useCallback, useEffect, useState, useRef } from 'react'
import { useNavigationState, useRoute } from '@react-navigation/native'
import { useSendDestinationRouter } from '../useSendDestinationRouter'

export const useSelectDestinationScreen = () => {
    const { destination, onFinished } = useSendFunds()
    const route = useRoute()
    const rootRouteKey = useNavigationState(state => state.routes[0]?.key)
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

    // The send sheet blocks swipe/backdrop dismissal, so the flow's root screen
    // must offer its own way out (a pure-NFT send starts here). Root-ness comes
    // from this route's position, not `canGoBack()`: that answers for the whole
    // stack, and picking a receiver re-renders this screen while the next one
    // is already on top, so it read true, dropped the close, and popping back
    // (which re-renders nothing) stranded the sheet.
    const canClose = route.key === rootRouteKey
    const handleClose = useCallback(() => onFinished?.(), [onFinished])

    // A name's address comes from Pera's backend. It only becomes the
    // destination once the chain itself vouches for it; nothing here
    // trusts the search result or a cache.
    const { network } = useNetwork()
    const { showToast } = useToast()
    const { t } = useLanguage()
    const [isVerifyingNfd, setIsVerifyingNfd] = useState(false)
    const verificationRef = useRef<AbortController | null>(null)
    useEffect(() => () => verificationRef.current?.abort(), [])

    const verifyThenResolve = useCallback(
        async (address: string, name: string) => {
            verificationRef.current?.abort()
            const controller = new AbortController()
            verificationRef.current = controller
            setIsVerifyingNfd(true)
            try {
                const verification = await verifyNameAddress({
                    name,
                    address,
                    network,
                    signal: controller.signal,
                })
                if (verification === 'verified') {
                    resolveDestination(address)
                    return
                }
                showToast({
                    title: t(
                        verification === 'mismatch'
                            ? 'send_funds.destination.nfd_mismatch_title'
                            : 'send_funds.destination.nfd_unavailable_title',
                        { name },
                    ),
                    body: t(
                        verification === 'mismatch'
                            ? 'send_funds.destination.nfd_mismatch_body'
                            : 'send_funds.destination.nfd_unavailable_body',
                        { name },
                    ),
                    type: 'error',
                })
            } catch (error) {
                if (controller.signal.aborted) return
                throw error
            } finally {
                if (!controller.signal.aborted) setIsVerifyingNfd(false)
            }
        },
        [network, resolveDestination, showToast, t],
    )

    const handleSelected = useCallback(
        (address: string, nfdName?: string) => {
            if (nfdName) {
                void verifyThenResolve(address, nfdName)
                return
            }
            resolveDestination(address)
        },
        [verifyThenResolve, resolveDestination],
    )

    return {
        selectedAsset,
        selectedAccount,
        handleSelected,
        isCheckingExternalOptIn: isResolvingDestination || isVerifyingNfd,
        isAutoAdvancing,
        canClose,
        onClose: handleClose,
    }
}
