/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import {
    AnalyticsService,
    AnalyticsServiceContainerKey,
} from '@perawallet/wallet-core-platform-integration'
import { ParamListBase, RouteProp } from '@react-navigation/native'
import { container } from 'tsyringe'

const NAVIGATION_STACK_NAMES = new Set([
    'tabbar',
    'settings',
    'onboarding',
    'contacts',
    'home',
])

let previousRouteName: string | null = null
export const resetPreviousRouteNameForTesting = () => {
    previousRouteName = null
}
export const screenListeners = ({
    route,
}: {
    route: RouteProp<ParamListBase>
}) => ({
    focus: () => {
        const currentRouteName = route.name.toLowerCase()

        if (
            !NAVIGATION_STACK_NAMES.has(currentRouteName) &&
            previousRouteName !== currentRouteName
        ) {
            const analyticsService = container.resolve<AnalyticsService>(
                AnalyticsServiceContainerKey,
            )
            analyticsService.logEvent(
                `scr_${currentRouteName ?? 'unknown'}_view`,
                {
                    previous: previousRouteName,
                    path: route.path,
                },
            )
            previousRouteName = currentRouteName
        }
    },
})
