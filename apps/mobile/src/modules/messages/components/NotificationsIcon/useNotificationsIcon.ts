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

import { useInboxStatus } from '@perawallet/wallet-core-messages'
import { useSpotBannersQuery } from '@perawallet/wallet-core-banners'
import { type ParamListBase, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { trackEvent, HomeEvent } from '@analytics'

const MAX_INBOX_COUNT_DISPLAY = 9

export type UseNotificationsIconResult = {
    showCountBadge: boolean
    showDotBadge: boolean
    countLabel: string
    goToNotifications: () => void
}

export const useNotificationsIcon = (): UseNotificationsIconResult => {
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { unreadInboxCount, hasUnreadNotifications, isUnavailableOnNetwork } =
        useInboxStatus()
    // Spot banners live on the Messages screen above the tabs, so any
    // outstanding spot banner is also an "unread" signal the icon should
    // surface. Left ungated deliberately: banners are a separate Pera-backed
    // surface with its own guard ticket, and it already yields nothing on a
    // non-backed network — gating it here would bake in an assumption this
    // ticket doesn't own.
    const { spotBanners } = useSpotBannersQuery()
    const hasSpotBanners = spotBanners.length > 0

    const goToNotifications = () => {
        trackEvent(HomeEvent.Notification)
        navigation.navigate('Messages')
    }

    const showCountBadge = !isUnavailableOnNetwork && unreadInboxCount > 0
    const showDotBadge =
        !showCountBadge &&
        ((!isUnavailableOnNetwork && hasUnreadNotifications) || hasSpotBanners)
    const countLabel =
        unreadInboxCount > MAX_INBOX_COUNT_DISPLAY
            ? `${MAX_INBOX_COUNT_DISPLAY}+`
            : String(unreadInboxCount)

    return {
        showCountBadge,
        showDotBadge,
        countLabel,
        goToNotifications,
    }
}
