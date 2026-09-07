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

import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import { NavigationHeader } from '@components/NavigationHeader'
import type { NativeStackHeaderProps } from '@react-navigation/native-stack'
import { createAppStackNavigator } from '@routes/createAppStackNavigator'
import { OnboardingScreen } from '@modules/onboarding/screens/OnboardingScreen'
import { screenListeners } from '@routes/listeners'
import { fullScreenLayout } from '@layouts/index'

import type { OnboardingStackParamList } from './types'
import {
    renderImportFlowScreens,
    withAccountErrorBoundary,
    type ImportFlowStack,
} from './shared-screens'

export type { OnboardingStackParamList } from './types'
export { AddAccountStackNavigator } from './add-account'

const OnboardingScreenWithErrorBoundary =
    withAccountErrorBoundary(OnboardingScreen)

const OnboardingStack = createAppStackNavigator<OnboardingStackParamList>()

export const OnboardingStackNavigator = () => {
    return (
        <OnboardingStack.Navigator
            initialRouteName='OnboardingHome'
            screenOptions={{
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader {...props} />
                ),
                ...SCREEN_ANIMATION_CONFIG,
            }}
            screenListeners={screenListeners}
        >
            <OnboardingStack.Screen
                name='OnboardingHome'
                options={{ headerShown: false }}
                layout={fullScreenLayout}
                component={OnboardingScreenWithErrorBoundary}
            />
            {renderImportFlowScreens(
                OnboardingStack as unknown as ImportFlowStack,
            )}
        </OnboardingStack.Navigator>
    )
}
