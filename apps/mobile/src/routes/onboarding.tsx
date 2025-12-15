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

import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import NavigationHeader from '@components/common/navigation-header/NavigationHeader'
import {
    createNativeStackNavigator,
    NativeStackHeaderProps,
} from '@react-navigation/native-stack'
import OnboardingScreen from '@modules/onboarding/screens/OnboardingScreen'
import NameAccountScreen from '@modules/onboarding/screens/NameAccountScreen'
import ImportAccountScreen from '@modules/onboarding/screens/ImportAccountScreen'
import { screenListeners } from './listeners'
import { safeAreaLayout } from './layouts'

export const OnboardingStack = createNativeStackNavigator({
    initialRouteName: 'OnboardingHome',
    screenOptions: {
        headerShown: false,
        header: (props: NativeStackHeaderProps) => (
            <NavigationHeader {...props} />
        ),
        ...SCREEN_ANIMATION_CONFIG,
    },
    layout: safeAreaLayout,
    screenListeners,
    screens: {
        OnboardingHome: OnboardingScreen,
        NameAccount: {
            screen: NameAccountScreen,
            options: {
                headerShown: true,
                headerTitle: 'Name your account',
            },
        },
        ImportAccount: {
            screen: ImportAccountScreen,
            options: {
                headerShown: true,
                headerTitle: 'Enter your Recovery Passphrase',
            },
        },
    },
})
