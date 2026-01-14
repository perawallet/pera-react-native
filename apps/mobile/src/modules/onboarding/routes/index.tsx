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
import NavigationHeader from '@components/NavigationHeader'
import {
    createNativeStackNavigator,
    NativeStackHeaderProps,
} from '@react-navigation/native-stack'
import OnboardingScreen from '@modules/onboarding/screens/OnboardingScreen'
import NameAccountScreen from '@modules/onboarding/screens/NameAccountScreen'
import ImportAccountScreen from '@modules/onboarding/screens/ImportAccountScreen'
import { AccountErrorBoundary } from '@modules/accounts/components/BaseErrorBoundary/AccountErrorBoundary'
import { useLanguage } from '@hooks/language'
import { screenListeners } from '@routes/listeners'
import { safeAreaLayout } from '@layouts/index'
import type React from 'react'
import { WalletAccount } from '@perawallet/wallet-core-accounts'

// Wrap screens with AccountErrorBoundary to catch account-related errors
const withAccountErrorBoundary = <P extends object>(
    WrappedComponent: React.ComponentType<P>,
): React.ComponentType<P> => {
    return (props: P) => {
        const { t } = useLanguage()
        return (
            <AccountErrorBoundary t={t}>
                <WrappedComponent {...props} />
            </AccountErrorBoundary>
        )
    }
}

const OnboardingScreenWithErrorBoundary =
    withAccountErrorBoundary(OnboardingScreen)
const NameAccountScreenWithErrorBoundary =
    withAccountErrorBoundary(NameAccountScreen)
const ImportAccountScreenWithErrorBoundary =
    withAccountErrorBoundary(ImportAccountScreen)

export type OnboardingStackParamList = {
    OnboardingHome: undefined
    NameAccount: {
        account: WalletAccount
    }
    ImportAccount: undefined
}

const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>()

export const OnboardingStackNavigator = () => {
    return (
        <OnboardingStack.Navigator
            initialRouteName='OnboardingHome'
            screenOptions={{
                headerShown: false,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader {...props} />
                ),
                ...SCREEN_ANIMATION_CONFIG,
            }}
            layout={safeAreaLayout}
            screenListeners={screenListeners}
        >
            <OnboardingStack.Screen
                name='OnboardingHome'
                component={OnboardingScreenWithErrorBoundary}
            />
            <OnboardingStack.Screen
                name='NameAccount'
                options={{
                    headerShown: true,
                    headerTitle: 'Name your account',
                }}
                component={NameAccountScreenWithErrorBoundary}
            />
            <OnboardingStack.Screen
                name='ImportAccount'
                options={{
                    headerShown: true,
                    headerTitle: 'Enter your Recovery Passphrase',
                }}
                component={ImportAccountScreenWithErrorBoundary}
            />
        </OnboardingStack.Navigator>
    )
}
