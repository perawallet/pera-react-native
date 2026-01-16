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

import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AppStackParamList } from '@routes/types'

export type AppNavigationProp = NativeStackNavigationProp<AppStackParamList>

export const useAppNavigation = () => {
    const navigation = useNavigation<AppNavigationProp>()

    return {
        navigate: <RouteName extends keyof AppStackParamList>(
            screen: RouteName,
            ...args: undefined extends AppStackParamList[RouteName]
                ? [params?: AppStackParamList[RouteName]]
                : {} extends AppStackParamList[RouteName]
                  ? [params?: AppStackParamList[RouteName]]
                  : [params: AppStackParamList[RouteName]]
        ) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(navigation.navigate as any)(screen, ...args)
        },
        push: <RouteName extends keyof AppStackParamList>(
            screen: RouteName,
            ...args: undefined extends AppStackParamList[RouteName]
                ? [params?: AppStackParamList[RouteName]]
                : {} extends AppStackParamList[RouteName]
                  ? [params?: AppStackParamList[RouteName]]
                  : [params: AppStackParamList[RouteName]]
        ) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(navigation.push as any)(screen, ...args)
        },
        replace: <RouteName extends keyof AppStackParamList>(
            screen: RouteName,
            ...args: undefined extends AppStackParamList[RouteName]
                ? [params?: AppStackParamList[RouteName]]
                : {} extends AppStackParamList[RouteName]
                  ? [params?: AppStackParamList[RouteName]]
                  : [params: AppStackParamList[RouteName]]
        ) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(navigation.replace as any)(screen, ...args)
        },
        goBack: () => navigation.goBack(),
        setOptions: navigation.setOptions,
        addListener: navigation.addListener,
        canGoBack: navigation.canGoBack,
        getParent: navigation.getParent,
        getState: navigation.getState,
        dispatch: navigation.dispatch,
        isFocused: navigation.isFocused,
        reset: navigation.reset,
    }
}
