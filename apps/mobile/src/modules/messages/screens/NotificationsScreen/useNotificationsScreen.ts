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

import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react'
import { type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import {
    type PeraNotification,
    useInboxStatus,
    useNotificationsListQuery,
    useMarkNotificationsAsReadMutation,
} from '@perawallet/wallet-core-messages'
import { type PWFlatListRef } from '@components/core'
import { useNotificationPress } from '@modules/messages/hooks'

// How close to the top (in px) the user must be for a newly-arrived
// notification to auto-scroll the list to reveal it. Past this distance the
// user is reading older notifications, so FlashList's maintainVisibleContent
// position keeps their place instead of yanking them to the top.
const NEAR_TOP_REVEAL_THRESHOLD_PX = 200

/**
 * Decides whether a change in the newest notification should scroll the list
 * back to the top. Extracted as a pure function so the reveal logic is unit
 * testable independently of the imperative scroll wiring.
 */
export const shouldRevealNewest = (
    prevNewestId: string | undefined,
    nextNewestId: string | undefined,
    scrollOffset: number,
    threshold: number,
): boolean => {
    // Nothing to reveal when the list is empty or the newest item is unchanged
    // (e.g. paginating older items appends to the bottom, leaving index 0 the
    // same).
    if (!nextNewestId || nextNewestId === prevNewestId) return false
    // The very first load has no previous id; the focus effect already snaps to
    // the top on open, so skip the in-session reveal here.
    if (prevNewestId === undefined) return false
    // Only reveal when the user is near the top; otherwise preserve their
    // reading position.
    return scrollOffset <= threshold
}

export type UseNotificationsScreenResult = {
    isPending: boolean
    notifications: PeraNotification[]
    isFetchingNextPage: boolean
    isRefetching: boolean
    keyExtractor: (item: PeraNotification) => string
    loadMoreItems: () => Promise<void>
    refetch: () => void
    handleNotificationPress: (notification: PeraNotification) => void
    listRef: RefObject<PWFlatListRef | null>
    handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
}

export const useNotificationsScreen = (): UseNotificationsScreenResult => {
    const { hasUnreadNotifications } = useInboxStatus()
    const {
        data,
        isPending,
        fetchNextPage,
        isFetchingNextPage,
        isRefetching,
        refetch,
    } = useNotificationsListQuery()
    const { markAsRead } = useMarkNotificationsAsReadMutation()
    const { handleNotificationPress } = useNotificationPress()

    const notifications = useMemo(() => data ?? [], [data])

    // Mark notifications as read only when leaving the screen (unmount), so the
    // per-item unread dots stay visible the whole time the user is viewing the
    // list instead of clearing the instant the screen gains focus. The cleanup
    // runs once on unmount, so we read the latest values from a ref rather than
    // closing over a stale first-render snapshot.
    const latestRef = useRef({ notifications, hasUnreadNotifications })
    latestRef.current = { notifications, hasUnreadNotifications }

    useEffect(() => {
        return () => {
            const { notifications, hasUnreadNotifications } = latestRef.current
            if (notifications.length > 0 && hasUnreadNotifications) {
                markAsRead(parseInt(notifications[0].id, 10))
            }
        }
    }, [markAsRead])

    // Auto-focus the latest notification. The newest item is at index 0 but the
    // list keeps maintainVisibleContentPosition enabled (FlashList v2 default),
    // so we imperatively scroll to the top instead of letting newer items pile
    // up above the viewport.
    const listRef = useRef<PWFlatListRef>(null)
    const scrollOffsetRef = useRef(0)
    const prevNewestIdRef = useRef<string | undefined>(undefined)

    const handleScroll = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            scrollOffsetRef.current = event.nativeEvent.contentOffset.y
        },
        [],
    )

    const newestId = notifications[0]?.id

    // Reveal a newly-arrived notification when the user is near the top; hold
    // their position (via MVCP) when they're scrolled into older items.
    useEffect(() => {
        if (
            shouldRevealNewest(
                prevNewestIdRef.current,
                newestId,
                scrollOffsetRef.current,
                NEAR_TOP_REVEAL_THRESHOLD_PX,
            )
        ) {
            listRef.current?.scrollToOffset({ offset: 0, animated: true })
        }
        prevNewestIdRef.current = newestId
    }, [newestId])

    // On open/refocus: pull the latest notifications so freshly-created ones
    // (e.g. after a rekey) show up without a manual refresh — the tab stays
    // mounted, so it would otherwise serve stale cache — then snap to the top
    // (it would also otherwise retain its previous scroll position). A newer
    // item arriving from the refetch is revealed by the effect above.
    useFocusEffect(
        useCallback(() => {
            void refetch()
            listRef.current?.scrollToOffset({ offset: 0, animated: false })
        }, [refetch]),
    )

    const loadMoreItems = async () => {
        await fetchNextPage()
    }

    return {
        isPending,
        notifications,
        isFetchingNextPage,
        isRefetching,
        keyExtractor: (item: PeraNotification) => item.id,
        loadMoreItems,
        refetch: () => void refetch(),
        handleNotificationPress,
        listRef,
        handleScroll,
    }
}
