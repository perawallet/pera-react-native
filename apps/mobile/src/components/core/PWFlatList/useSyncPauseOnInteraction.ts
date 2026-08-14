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

import { useCallback, useEffect, useRef } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { pauseSync, resumeSync } from '@perawallet/wallet-core-background'

type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>
type ScrollHandler = (event: ScrollEvent) => void

export type SyncPauseScrollHandlers = {
    onScrollBeginDrag?: ScrollHandler
    onScrollEndDrag?: ScrollHandler
    onMomentumScrollBegin?: ScrollHandler
    onMomentumScrollEnd?: ScrollHandler
}

/**
 * A flick's momentum is the part that janks most, so the release after a drag
 * ends is deferred long enough for `onMomentumScrollBegin` to cancel it. Only
 * has to outlast the gap between those two events.
 */
const MOMENTUM_GRACE_MS = 150

/**
 * Holds background sync off the JS thread while this list is being scrolled, and
 * releases it once the gesture — including any momentum — finishes.
 *
 * Drag/momentum boundaries rather than `onScroll`: a handful of events per
 * gesture instead of one per frame, so the mechanism doesn't add the very
 * main-thread work it exists to avoid.
 *
 * Returns handlers wrapping whatever the caller passed, so opting a list in
 * never costs it its own scroll callbacks.
 */
export const useSyncPauseOnInteraction = (
    isEnabled: boolean,
    handlers: SyncPauseScrollHandlers,
): SyncPauseScrollHandlers => {
    // Whether *this* list currently holds a pause. The service ref-counts across
    // lists, so a list must never release one it doesn't hold — that would
    // decrement another mounted list's pause (the account tabs all stay
    // mounted). Keeps this list's calls balanced however its events arrive.
    const isHoldingPause = useRef(false)
    const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const cancelPendingRelease = useCallback(() => {
        if (releaseTimer.current !== null) {
            clearTimeout(releaseTimer.current)
            releaseTimer.current = null
        }
    }, [])

    const acquire = useCallback(() => {
        cancelPendingRelease()
        if (isHoldingPause.current) return
        isHoldingPause.current = true
        pauseSync()
    }, [cancelPendingRelease])

    const release = useCallback(() => {
        cancelPendingRelease()
        if (!isHoldingPause.current) return
        isHoldingPause.current = false
        resumeSync()
    }, [cancelPendingRelease])

    // Unmounting mid-scroll (navigating away, a tab swap) means no end-of-gesture
    // event ever arrives. The service's own deadline would eventually recover,
    // but releasing here keeps the common case exact instead of waiting it out.
    useEffect(() => release, [release])

    // Opting out mid-gesture would otherwise strand a held pause until the
    // service's deadline fired.
    useEffect(() => {
        if (!isEnabled) release()
    }, [isEnabled, release])

    const onScrollBeginDrag = useCallback(
        (event: ScrollEvent) => {
            acquire()
            handlers.onScrollBeginDrag?.(event)
        },
        [acquire, handlers],
    )

    const onScrollEndDrag = useCallback(
        (event: ScrollEvent) => {
            // Deferred, not immediate: a flick continues under momentum after
            // this fires, and that is the part worth protecting. If momentum
            // starts, onMomentumScrollBegin cancels this; if the finger simply
            // lifted with no flick, no momentum event ever comes and this is
            // what releases the pause.
            cancelPendingRelease()
            releaseTimer.current = setTimeout(release, MOMENTUM_GRACE_MS)
            handlers.onScrollEndDrag?.(event)
        },
        [cancelPendingRelease, release, handlers],
    )

    const onMomentumScrollBegin = useCallback(
        (event: ScrollEvent) => {
            // Keep holding: the list is still moving.
            acquire()
            handlers.onMomentumScrollBegin?.(event)
        },
        [acquire, handlers],
    )

    const onMomentumScrollEnd = useCallback(
        (event: ScrollEvent) => {
            release()
            handlers.onMomentumScrollEnd?.(event)
        },
        [release, handlers],
    )

    if (!isEnabled) {
        return handlers
    }

    return {
        onScrollBeginDrag,
        onScrollEndDrag,
        onMomentumScrollBegin,
        onMomentumScrollEnd,
    }
}
