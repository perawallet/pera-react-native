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

import {
    createNativeStackNavigator,
    type NativeStackHeaderProps,
} from '@react-navigation/native-stack'
import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import { NavigationHeader } from '@components/NavigationHeader'
import { screenListeners } from '@routes/listeners'
import { PeraCardIntroScreen } from '../screens/PeraCardIntroScreen'
import { CardSignInScreen } from '../screens/CardSignInScreen'
import { CardForgotPasswordScreen } from '../screens/CardForgotPasswordScreen'
import { CardForgotPasswordVerifyScreen } from '../screens/CardForgotPasswordVerifyScreen'
import { CardForgotPasswordNewPasswordScreen } from '../screens/CardForgotPasswordNewPasswordScreen'
import { CardOnboardingStackNavigator } from './card-onboarding'
import { type PeraCardStackParamList } from './types'

export type {
    PeraCardStackParamList,
    PeraCardAccountStackParamList,
    PeraCardFlowParamList,
} from './types'

const PeraCardStack = createNativeStackNavigator<PeraCardStackParamList>()

export const PeraCardStackNavigator = () => {
    return (
        <PeraCardStack.Navigator
            initialRouteName='PeraCardIntro'
            screenOptions={{
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader {...props} />
                ),
                ...SCREEN_ANIMATION_CONFIG,
            }}
            screenListeners={screenListeners}
        >
            <PeraCardStack.Screen
                name='PeraCardIntro'
                options={{ title: 'peraCard.intro.navigation_title' }}
                component={PeraCardIntroScreen}
            />
            <PeraCardStack.Screen
                name='CardSignIn'
                options={{ title: 'peraCard.sign_in.navigation_title' }}
                component={CardSignInScreen}
            />
            <PeraCardStack.Screen
                name='CardForgotPassword'
                options={{ title: 'peraCard.forgot_password.navigation_title' }}
                component={CardForgotPasswordScreen}
            />
            <PeraCardStack.Screen
                name='CardForgotPasswordVerify'
                options={{ title: 'peraCard.forgot_password.verify_navigation_title' }}
                component={CardForgotPasswordVerifyScreen}
            />
            <PeraCardStack.Screen
                name='CardForgotPasswordNewPassword'
                options={{
                    title: 'peraCard.forgot_password.new_password_navigation_title',
                }}
                component={CardForgotPasswordNewPasswordScreen}
            />
            <PeraCardStack.Screen
                name='CardOnboarding'
                options={{ headerShown: false }}
                component={CardOnboardingStackNavigator}
            />
        </PeraCardStack.Navigator>
    )
}
