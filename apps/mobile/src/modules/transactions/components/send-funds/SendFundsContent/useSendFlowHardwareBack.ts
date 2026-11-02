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

import { useContext, useEffect, useRef } from 'react'
import { BackHandler, type NativeEventSubscription } from 'react-native'
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { useSendFlowClose } from '@modules/transactions/hooks/send-funds/useSendFlowClose'
import type { SendFundsStackParamList } from '@modules/transactions/routes/send-funds/types'
import type { Optional } from '@perawallet/wallet-core-shared'
import { isAndroid } from '@utils/platform'

// Pops a screen, or closes the flow the way the X does. It must sit above the
// navigator's own back listener (RN runs the latest-registered first) so a
// sheet over the flow can swallow back instead of the stack popping under it.
export const useSendFlowHardwareBack = (
    navigationRef: NavigationContainerRefWithCurrent<SendFundsStackParamList>,
): void => {
    const sheetId = useContext(BottomSheetIdContext)
    const { requestClose } = useSendFlowClose()
    // A ref so a new callback never re-subscribes, which would reorder the
    // back listeners.
    const requestCloseRef = useRef(requestClose)
    requestCloseRef.current = requestClose
    const subscriptionRef = useRef<Optional<NativeEventSubscription>>(undefined)
    const wasNavigatorReadyRef = useRef<Optional<boolean>>(undefined)

    // No deps on purpose: asset-scoped entries mount the navigator a render
    // later, which puts its listener above ours; resubscribe when that flips.
    useEffect(() => {
        if (!isAndroid()) return
        const isNavigatorReady = navigationRef.isReady()
        if (
            subscriptionRef.current &&
            wasNavigatorReadyRef.current === isNavigatorReady
        ) {
            return
        }
        subscriptionRef.current?.remove()
        wasNavigatorReadyRef.current = isNavigatorReady
        subscriptionRef.current = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                const topSheetId = useBottomSheetStore
                    .getState()
                    .requests.filter(request => request.isVisible)
                    .at(-1)?.id
                // A sheet over the flow owns back; swallow it so the
                // navigator's own listener below can't pop the stack.
                if (topSheetId !== sheetId) return true
                if (!navigationRef.isReady()) return false
                if (navigationRef.canGoBack()) {
                    navigationRef.goBack()
                } else {
                    requestCloseRef.current()
                }
                return true
            },
        )
    })

    useEffect(
        () => () => {
            subscriptionRef.current?.remove()
            subscriptionRef.current = undefined
        },
        [],
    )
}
