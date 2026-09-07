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
import { PWIcon } from '@components/core'
import { CardOnboardingEmailScreen } from '../../screens/CardOnboardingEmailScreen'
import { CardOnboardingEmailVerifyScreen } from '../../screens/CardOnboardingEmailVerifyScreen'
import { CardOnboardingPasswordScreen } from '../../screens/CardOnboardingPasswordScreen'
import { CardOnboardingPhoneScreen } from '../../screens/CardOnboardingPhoneScreen'
import { CardOnboardingPhoneVerifyScreen } from '../../screens/CardOnboardingPhoneVerifyScreen'
import { CardOnboardingPersonalDetailsScreen } from '../../screens/CardOnboardingPersonalDetailsScreen'
import { CardOnboardingAddressScreen } from '../../screens/CardOnboardingAddressScreen'
import { CardOnboardingVerificationScreen } from '../../screens/CardOnboardingVerificationScreen'
import { CardOnboardingStatusScreen } from '../../screens/CardOnboardingStatusScreen'
import { CardCreateSigningScreen } from '../../screens/CardCreateSigningScreen'
import { CardAutoFundingSigningScreen } from '../../screens/CardAutoFundingSigningScreen'
import type { CardOnboardingStackParamList } from './types'

const Stack = createNativeStackNavigator<CardOnboardingStackParamList>()

export const CardOnboardingStackNavigator = () => {
    return (
        <Stack.Navigator
            initialRouteName='CardOnboardingEmail'
            screenOptions={{
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader {...props} />
                ),
                ...SCREEN_ANIMATION_CONFIG,
            }}
        >
            <Stack.Screen
                name='CardOnboardingEmail'
                component={CardOnboardingEmailScreen}
                options={{ title: 'peraCard.create_account.navigation_title' }}
            />
            <Stack.Screen
                name='CardOnboardingEmailVerify'
                component={CardOnboardingEmailVerifyScreen}
                options={{ title: 'peraCard.verify_email.navigation_title' }}
            />
            <Stack.Screen
                name='CardOnboardingPassword'
                component={CardOnboardingPasswordScreen}
                options={{ title: 'peraCard.create_password.navigation_title' }}
            />
            <Stack.Screen
                name='CardOnboardingPhone'
                component={CardOnboardingPhoneScreen}
                options={{
                    title: 'peraCard.verify_phone.entry_navigation_title',
                }}
            />
            <Stack.Screen
                name='CardOnboardingPhoneVerify'
                component={CardOnboardingPhoneVerifyScreen}
                options={{ title: 'peraCard.verify_phone.navigation_title' }}
            />
            <Stack.Screen
                name='CardOnboardingVerification'
                component={CardOnboardingVerificationScreen}
                options={{ title: 'peraCard.intro.navigation_title' }}
            />
            <Stack.Screen
                name='CardOnboardingStatus'
                component={CardOnboardingStatusScreen}
                options={{ title: '' }}
            />
            <Stack.Screen
                name='CardOnboardingPersonalDetails'
                component={CardOnboardingPersonalDetailsScreen}
                options={{
                    title: 'peraCard.personal_details.navigation_title',
                }}
            />
            <Stack.Screen
                name='CardOnboardingAddress'
                component={CardOnboardingAddressScreen}
                options={{ title: 'peraCard.address.navigation_title' }}
            />
            <Stack.Screen
                name='CardOnboardingSigning'
                component={CardCreateSigningScreen}
                // Card creation is in flight — swipe/back-chevron disabled;
                // only the explicit close button can leave this screen.
                options={({ navigation }) => ({
                    headerShown: true,
                    gestureEnabled: false,
                    title: '',
                    headerLeft: () => null,
                    headerRight: () => (
                        <PWIcon
                            name='cross'
                            onPress={() => navigation.goBack()}
                            testID='card-create-signing-close'
                        />
                    ),
                })}
            />
            <Stack.Screen
                name='CardOnboardingAutoFundingSigning'
                component={CardAutoFundingSigningScreen}
                // Same in-flight treatment as CardOnboardingSigning — the
                // card already exists at this point; only Cancel (which
                // degrades to Manual) can leave, not a swipe/back-chevron.
                options={{ headerShown: false, gestureEnabled: false }}
            />
        </Stack.Navigator>
    )
}
