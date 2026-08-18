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

import { getProvider } from '@perawallet/wallet-extension-provider'
import { type ParamListBase, type RouteProp } from '@react-navigation/native'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    trackScreen,
    trackEvent,
    AnalyticsScreenName,
    AnalyticsMetadataKey,
    NavigationEvent,
} from '@analytics'

const NAVIGATION_STACK_NAMES = new Set([
    'tabbar',
    'settings',
    'onboarding',
    'contacts',
    'home',
])

/**
 * Centralized, typed screen-view tracking. Maps a stack route name to its
 * catalog {@link AnalyticsScreenName}, so screens don't each need a
 * `useEffect(() => trackScreen(...))`. This rides the per-stack `focus` event,
 * which reports the stack-level route name — so screens that host a nested tab
 * navigator (e.g. `AccountDetails`, `AssetDetails`) still resolve to the right
 * screen here rather than to their inner tab route.
 *
 * Not every tracked screen can live here:
 * - `TransactionDetails` is also mounted in the signing flow's own
 *   `NavigationContainer` (no `screenListeners`), so it keeps an in-screen call.
 * - `ShowQr` is a bottom sheet (not a navigation route).
 */
const ROUTE_TO_SCREEN: Record<string, AnalyticsScreenName> = {
    AccountDetails: AnalyticsScreenName.AccountList,
    CollectibleDetails: AnalyticsScreenName.CollectibleList,
    ContactsList: AnalyticsScreenName.ContactList,
    ViewContact: AnalyticsScreenName.ContactDetail,
}

/**
 * Resolves the catalog screen for a focused route. `AssetDetails` is special:
 * the route serves both fungible assets and collectibles, but only the asset
 * view is reported as `screen_asset_detail` (mirrors the previous in-screen
 * guard `assetId && !isCollectible`).
 */
const resolveTrackedScreen = (
    route: RouteProp<ParamListBase>,
): Nullable<AnalyticsScreenName> => {
    if (route.name === 'AssetDetails') {
        const params = route.params as
            | { assetId?: string; isCollectible?: boolean }
            | undefined
        return params?.assetId && !params.isCollectible
            ? AnalyticsScreenName.AssetDetail
            : null
    }
    return ROUTE_TO_SCREEN[route.name] ?? null
}

// Fire each screen view once per route instance (keyed on `route.key`), matching
// the previous `useEffect`-on-mount semantics rather than re-firing on every
// re-focus (e.g. tab switches / back navigation to a still-mounted screen).
const trackedScreenKeys = new Set<string>()
export const resetTrackedScreenForTesting = () => {
    trackedScreenKeys.clear()
}

let previousRouteName: Nullable<string> = null
export const resetPreviousRouteNameForTesting = () => {
    previousRouteName = null
}
export const screenListeners = ({
    route,
}: {
    route: RouteProp<ParamListBase>
}) => ({
    focus: () => {
        // 1) Typed, per-app catalog screen view (routed through `trackScreen`,
        //    so it gets the testnet prefix and the typed event keys).
        const screen = resolveTrackedScreen(route)
        if (screen && route.key && !trackedScreenKeys.has(route.key)) {
            trackedScreenKeys.add(route.key)
            trackScreen(screen)
        }

        // 2) Generic auto screen-view event (unchanged).
        const currentRouteName = route.name?.toLowerCase() || 'unknown'

        if (
            !NAVIGATION_STACK_NAMES.has(currentRouteName) &&
            previousRouteName !== currentRouteName
        ) {
            const analyticsService = getProvider().analytics
            analyticsService.logEvent(`scr_${currentRouteName}_view`, {
                previous: previousRouteName,
                path: route.path,
            })

            // 3) GA4-standard page_view with the view title as a param. Kept
            //    alongside scr_*_view so existing dashboards keep working.
            trackEvent(NavigationEvent.PageView, {
                [AnalyticsMetadataKey.PageTitle]: currentRouteName,
                [AnalyticsMetadataKey.PreviousScreen]: previousRouteName,
                [AnalyticsMetadataKey.Path]: route.path,
            })

            previousRouteName = currentRouteName
        }
    },
})
