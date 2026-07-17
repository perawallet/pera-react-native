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

// Web replacement for ReceiveFundsRoutes. The native version nests a
// `@react-navigation/stack` (JS "Stack") navigator, whose web output
// (CardStack -> MaybeScreenContainer -> Card -> CardContent) relies on a
// chain of `flex: 1` Views resolving a real pixel height via CSS. Nested
// inside PWBottomSheet.web.tsx's Modal (itself nested in
// NavigationIndependentTree, with no real window resize to re-trigger
// layout), one link in that chain — CardStack's own `MaybeScreenContainer`
// wrapper — collapses to `height: 0` (a plain, unstyled View whose only
// child is `position: absolute`, so it has no in-flow content to size
// against). CardContent's `{flex: 1, overflow: 'hidden'}` then clips
// everything below it, even though the actual screen content (verified via
// DOM inspection) renders at correct-looking coordinates underneath — the
// sheet paints fully blank.
//
// `@react-navigation/native-stack` doesn't hit this: its web screens
// (react-native-screens' ScreenStack.web.js /Screen.web.js) are plain Views
// with no CardContent-style measure-then-clip step, matching WebMainRoutes
// (routes/WebMainRoutes.tsx), which already uses native-stack successfully
// for the main app's own nested navigation on web. Swapping just this one
// nested sheet navigator to native-stack sidesteps the collapse instead of
// patching react-navigation/stack's internals.
import {
    createNativeStackNavigator,
    type NativeStackHeaderProps,
} from '@react-navigation/native-stack'

import { PWIcon } from '@components/core'
import { NavigationHeader } from '@components/NavigationHeader'
import { useReceiveFunds } from '@modules/transactions/hooks'
import { AccountSelectionScreen } from '../../screens/receive-funds/AccountSelectionScreen'
import { QRViewScreen } from '../../screens/receive-funds/QRViewScreen'
import { useStyles } from './styles'
import type { ReceiveFundsStackParamList } from './types'

const Stack = createNativeStackNavigator<ReceiveFundsStackParamList>()

export const ReceiveFundsRoutes = () => {
    const { canSelectAccount, onFinished } = useReceiveFunds()
    const styles = useStyles()

    return (
        <Stack.Navigator
            initialRouteName={canSelectAccount ? 'AccountSelection' : 'QRView'}
            screenOptions={{
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader
                        {...props}
                        safeArea={false}
                    />
                ),
                contentStyle: [styles.screenContent, styles.tabItem],
            }}
        >
            <Stack.Screen
                name='AccountSelection'
                component={AccountSelectionScreen}
                options={{
                    title: 'receive_funds.account_selection.title',
                    headerLeft: () => (
                        <PWIcon
                            name='cross'
                            onPress={onFinished}
                        />
                    ),
                }}
            />

            <Stack.Screen
                name='QRView'
                component={QRViewScreen}
            />
        </Stack.Navigator>
    )
}
