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

import { trackEvent, CardEvent } from '@analytics'
import { createPWTabNavigator } from '@components/core/PWTabView/PWTabView'
import { useLanguage } from '@hooks/useLanguage'
import { PeraCardOverview } from '../PeraCardOverview'
import { PeraCardDetails } from '../PeraCardDetails'

type PeraCardTabsParamsList = {
    Overview: undefined
    CardDetails: undefined
}

const Tab = createPWTabNavigator<PeraCardTabsParamsList>()

export const PeraCardTabNavigator = () => {
    const { t } = useLanguage()

    return (
        <Tab.Navigator
            screenListeners={({ route, navigation }) => ({
                tabPress: () => {
                    // Re-tapping the focused tab is not a switch.
                    if (navigation.isFocused()) return
                    trackEvent(
                        route.name === 'CardDetails'
                            ? CardEvent.HomeCardDetailsTab
                            : CardEvent.HomeOverviewTab,
                    )
                },
            })}
        >
            <Tab.Screen
                name='Overview'
                options={{ title: t('peraCard.account.overview_tab') }}
                component={PeraCardOverview}
            />
            <Tab.Screen
                name='CardDetails'
                options={{ title: t('peraCard.account.card_details_tab') }}
                component={PeraCardDetails}
            />
        </Tab.Navigator>
    )
}
