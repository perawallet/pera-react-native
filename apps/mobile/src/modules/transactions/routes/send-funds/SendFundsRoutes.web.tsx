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

// Web replacement for SendFundsRoutes — same root cause and fix as
// ReceiveFundsRoutes.web.tsx. The native version nests a
// `@react-navigation/stack` (JS "Stack") navigator, whose web output
// (CardStack -> MaybeScreenContainer -> Card -> CardContent) relies on a
// chain of `flex: 1` Views resolving a real pixel height via CSS. Nested
// inside PWBottomSheet.web.tsx's Modal (itself nested in
// NavigationIndependentTree, with no real window resize to re-trigger
// layout), one link in that chain — CardStack's own `MaybeScreenContainer`
// wrapper — can collapse to `height: 0` (a plain, unstyled View whose only
// child is `position: absolute`, so it has no in-flow content to size
// against). CardContent's `{flex: 1, overflow: 'hidden'}` then clips
// everything below it. AssetSelectionScreen (the initial route whenever the
// sheet is opened without a pre-selected asset, e.g. the home tab's Send
// button — AccountOverview/useAccountOverview.tsx's openSendFunds) renders a
// FlashList-backed AccountAssetSelectionList, structurally the same shape as
// ReceiveFundsRoutes' AccountSelectionScreen (also a FlashList picker), which
// is exactly the screen that went blank pre-fix there.
//
// `@react-navigation/native-stack` doesn't hit this: its web screens
// (react-native-screens' ScreenStack.web.js /Screen.web.js) are plain Views
// with no CardContent-style measure-then-clip step, matching WebMainRoutes
// (routes/WebMainRoutes.tsx) and the already-fixed ReceiveFundsRoutes.web.tsx.
// Swapping just this one nested sheet navigator to native-stack sidesteps the
// collapse instead of patching react-navigation/stack's internals.
import {
    createNativeStackNavigator,
    type NativeStackHeaderProps,
} from '@react-navigation/native-stack'

import { PWIcon } from '@components/core'
import { NavigationHeader } from '@components/NavigationHeader'
import {
    isCollectible,
    isPureNft,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import { useSendFunds } from '@modules/transactions/hooks'
import { AssetSelectionScreen } from '../../screens/send-funds/AssetSelectionScreen/AssetSelectionScreen'
import { InputScreen } from '../../screens/send-funds/InputScreen/InputScreen'
import { SelectDestinationScreen } from '../../screens/send-funds/SelectDestinationScreen/SelectDestinationScreen'
import { TransactionConfirmationScreen } from '../../screens/send-funds/TransactionConfirmationScreen/TransactionConfirmationScreen'
import { ExpressSendScreen } from '../../screens/send-funds/ExpressSendScreen'
import { ARC59SendSummaryScreen } from '../../screens/send-funds/ARC59SendSummaryScreen'
import { InsufficientBalanceScreen } from '../../screens/send-funds/InsufficientBalanceScreen'
import { TransactionProcessingScreen } from '../../screens/send-funds/TransactionProcessingScreen'
import { TransactionSuccessScreen } from '../../screens/send-funds/TransactionSuccessScreen'
import { useStyles } from './styles'
import type { SendFundsStackParamList } from './types'

const Stack = createNativeStackNavigator<SendFundsStackParamList>()

export const SendFundsRoutes = () => {
    const { canSelectAsset, selectedAssetId, onFinished } = useSendFunds()
    const styles = useStyles()

    const { data: assets } = useAssetsQuery(
        selectedAssetId ? [selectedAssetId] : [],
    )
    const selectedAsset = selectedAssetId
        ? assets.get(selectedAssetId)
        : undefined
    const isPureCollectible = selectedAsset
        ? isCollectible(selectedAsset) && isPureNft(selectedAsset)
        : false

    const initialRouteName = canSelectAsset
        ? 'AssetSelection'
        : isPureCollectible
          ? 'SelectDestination'
          : 'InputAmount'

    return (
        <Stack.Navigator
            initialRouteName={initialRouteName}
            screenOptions={{
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader
                        {...props}
                        safeArea={false}
                        paddingStyle='dense'
                    />
                ),
                contentStyle: [styles.screenContent, styles.tabItem],
            }}
        >
            <Stack.Screen
                name='AssetSelection'
                component={AssetSelectionScreen}
                options={{
                    title: 'send_funds.asset_selection.title',
                    headerLeft: () => (
                        <PWIcon
                            name='cross'
                            onPress={onFinished}
                        />
                    ),
                }}
            />

            <Stack.Screen
                name='InputAmount'
                component={InputScreen}
            />

            <Stack.Screen
                name='SelectDestination'
                component={SelectDestinationScreen}
            />

            <Stack.Screen
                name='ConfirmTransaction'
                component={TransactionConfirmationScreen}
                options={{
                    title: 'send_funds.confirmation.title',
                }}
            />

            <Stack.Screen
                name='ExpressSend'
                component={ExpressSendScreen}
                options={{
                    title: 'send_funds.express_send.title',
                }}
            />

            <Stack.Screen
                name='ARC59SendSummary'
                component={ARC59SendSummaryScreen}
                options={{
                    headerShown: false,
                }}
            />

            <Stack.Screen
                name='InsufficientBalance'
                component={InsufficientBalanceScreen}
                options={{
                    title: 'send_funds.insufficient_balance.title',
                }}
            />

            <Stack.Screen
                name='TransactionProcessing'
                component={TransactionProcessingScreen}
                options={{
                    headerShown: false,
                    gestureEnabled: false,
                }}
            />

            <Stack.Screen
                name='TransactionSuccess'
                component={TransactionSuccessScreen}
                options={{
                    headerShown: false,
                    gestureEnabled: false,
                }}
            />
        </Stack.Navigator>
    )
}
