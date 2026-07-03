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
    createNativeStackNavigator,
    type NativeStackHeaderProps,
} from '@react-navigation/native-stack'
import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import { NavigationHeader } from '@components/NavigationHeader'
import { screenListeners } from '@routes/listeners'
import { PeraCardIntroScreen } from '../screens/PeraCardIntroScreen'
import { CardSignInScreen } from '../screens/CardSignInScreen'
import { PeraCardAccountScreen } from '../screens/PeraCardAccountScreen'
import { CardAddFundsScreen } from '../screens/CardAddFundsScreen'
import { CardConfirmSwapScreen } from '../screens/CardConfirmSwapScreen'
import { CardWithdrawScreen } from '../screens/CardWithdrawScreen'
import { CardTransactionsScreen } from '../screens/CardTransactionsScreen'
import { CardTransactionDetailScreen } from '../screens/CardTransactionDetailScreen'
import { CardOnboardingStackNavigator } from './card-onboarding'
import { type PeraCardStackParamList } from './types'

export type { PeraCardStackParamList } from './types'

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
                name='CardOnboarding'
                options={{ headerShown: false }}
                component={CardOnboardingStackNavigator}
            />
            <PeraCardStack.Screen
                name='PeraCardAccount'
                options={{ headerShown: false }}
                component={PeraCardAccountScreen}
            />
            <PeraCardStack.Screen
                name='CardAddFunds'
                options={{ title: 'peraCard.add_funds.navigation_title' }}
                component={CardAddFundsScreen}
            />
            <PeraCardStack.Screen
                name='CardConfirmSwap'
                options={{ title: 'peraCard.confirm_swap.navigation_title' }}
                component={CardConfirmSwapScreen}
            />
            <PeraCardStack.Screen
                name='CardWithdraw'
                options={{ title: 'peraCard.withdraw.navigation_title' }}
                component={CardWithdrawScreen}
            />
            <PeraCardStack.Screen
                name='CardTransactions'
                options={{ title: 'peraCard.transactions.navigation_title' }}
                component={CardTransactionsScreen}
            />
            <PeraCardStack.Screen
                name='CardTransactionDetail'
                options={{ title: '' }}
                component={CardTransactionDetailScreen}
            />
        </PeraCardStack.Navigator>
    )
}
