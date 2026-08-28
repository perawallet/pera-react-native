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

import { useMemo } from 'react'
import { Gesture } from 'react-native-gesture-handler'
import {
    runOnJS,
    useSharedValue,
    withSpring,
    type SharedValue,
} from 'react-native-reanimated'

import {
    PWDRAWER_ACTIVATION_OFFSET,
    PWDRAWER_COMMIT_THRESHOLD,
    PWDRAWER_FLING_VELOCITY,
    PWDRAWER_SPRING_CONFIG,
    PWDRAWER_VERTICAL_CANCEL_OFFSET,
} from './constants'

export type UsePWDrawerDragParams = {
    progress: SharedValue<number>
    panelWidth: number
    onOpen: () => void
    onClose: () => void
    isEnabled?: boolean
    /**
     * Adds tap-to-dismiss. Only ever safe on a surface outside the panel — the
     * panel's own list has to stay tappable.
     */
    hasTapToClose?: boolean
}

/**
 * The drawer's drag, shared by every surface that can move it.
 *
 * `activeOffsetX` with `failOffsetY` is what lets this coexist with a vertical
 * list underneath: a mostly-vertical drag fails the pan and the list scrolls,
 * a mostly-horizontal one takes over. That cooperation only works because the
 * pan receives ACTION_DOWN — see PWDrawerGestureSurface for the case where
 * something upstream takes it away.
 */
export const usePWDrawerDrag = ({
    progress,
    panelWidth,
    onOpen,
    onClose,
    isEnabled = true,
    hasTapToClose = false,
}: UsePWDrawerDragParams) => {
    // Shared, not a captured plain object: the worklet runs on the UI thread and
    // would only ever mutate its own frozen copy.
    const dragStart = useSharedValue(0)

    return useMemo(() => {
        const pan = Gesture.Pan()
            .enabled(isEnabled)
            .activeOffsetX([
                -PWDRAWER_ACTIVATION_OFFSET,
                PWDRAWER_ACTIVATION_OFFSET,
            ])
            .failOffsetY([
                -PWDRAWER_VERTICAL_CANCEL_OFFSET,
                PWDRAWER_VERTICAL_CANCEL_OFFSET,
            ])
            .onStart(() => {
                'worklet'
                dragStart.value = progress.value
            })
            .onUpdate(event => {
                'worklet'
                const next = dragStart.value + event.translationX / panelWidth
                progress.value = Math.min(Math.max(next, 0), 1)
            })
            .onEnd(event => {
                'worklet'
                const shouldOpen =
                    event.velocityX > PWDRAWER_FLING_VELOCITY
                        ? true
                        : event.velocityX < -PWDRAWER_FLING_VELOCITY
                          ? false
                          : progress.value > PWDRAWER_COMMIT_THRESHOLD

                progress.value = withSpring(
                    shouldOpen ? 1 : 0,
                    PWDRAWER_SPRING_CONFIG,
                )

                if (shouldOpen) {
                    runOnJS(onOpen)()
                } else {
                    runOnJS(onClose)()
                }
            })

        if (!hasTapToClose) return pan

        const tap = Gesture.Tap()
            .enabled(isEnabled)
            .onEnd(() => {
                'worklet'
                progress.value = withSpring(0, PWDRAWER_SPRING_CONFIG)
                runOnJS(onClose)()
            })

        return Gesture.Race(pan, tap)
    }, [
        progress,
        dragStart,
        panelWidth,
        onOpen,
        onClose,
        isEnabled,
        hasTapToClose,
    ])
}
