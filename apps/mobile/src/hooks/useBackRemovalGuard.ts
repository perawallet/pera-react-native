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

import { useEffect, useRef } from 'react'
import {
    useNavigation,
    type NavigationAction,
    type ParamListBase,
} from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

type BackRemovalGuardOptions = {
    /** Refuses the action outright and drops the back affordance while true. */
    isBlocking?: boolean
    /**
     * Runs once a back action has been prevented, to decide what happens
     * instead. Call `allowRemoval` before navigating away, or the guard
     * intercepts that too.
     */
    onBackAttempt?: (action: NavigationAction, allowRemoval: () => void) => void
}

/**
 * Intercepts only the back-shaped removals, so the `replace` or `reset` a
 * screen navigates with when its work finishes still goes through —
 * `useNavigationLock` and `usePreventRemove` both prevent every removal and
 * cannot express that.
 */
export const useBackRemovalGuard = ({
    isBlocking = false,
    onBackAttempt,
}: BackRemovalGuardOptions = {}): void => {
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const hasAllowedRemovalRef = useRef(false)

    // iOS dismisses on the edge swipe natively and only then dispatches the
    // POP, so the gesture has to be off exactly when this listener intends to
    // intercept — otherwise the guard is Android-only.
    const isIntercepting = isBlocking || Boolean(onBackAttempt)

    useEffect(() => {
        navigation.setOptions({
            headerLeft: isBlocking ? () => null : undefined,
            // `undefined`, not `true`, so an idle guard leaves a route that
            // disabled the gesture for its own reasons alone.
            gestureEnabled: isIntercepting ? false : undefined,
        })
    }, [navigation, isBlocking, isIntercepting])

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', event => {
            if (hasAllowedRemovalRef.current || !isIntercepting) return
            const { type } = event.data.action
            if (type !== 'GO_BACK' && type !== 'POP') return
            event.preventDefault()
            if (isBlocking) return
            onBackAttempt?.(event.data.action, () => {
                hasAllowedRemovalRef.current = true
            })
        })

        return () => {
            unsubscribe()
            hasAllowedRemovalRef.current = false
        }
    }, [navigation, isBlocking, isIntercepting, onBackAttempt])
}
