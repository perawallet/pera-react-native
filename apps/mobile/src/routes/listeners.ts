import { AnalyticsService, AnalyticsServiceContainerKey } from "@perawallet/wallet-core-platform-integration"
import { ParamListBase, RouteProp } from "@react-navigation/native"
import { container } from "tsyringe"

const NAVIGATION_STACK_NAMES = new Set([
    'tabbar',
    'settings',
    'onboarding',
    'contacts',
    'home',
])

let previousRouteName: string | null = null
export const screenListeners = ({ route }: { route: RouteProp<ParamListBase> }) => ({
    focus: () => {
        const currentRouteName = route.name.toLowerCase() ?? null

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