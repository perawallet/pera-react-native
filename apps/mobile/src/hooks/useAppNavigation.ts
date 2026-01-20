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

type NavigationArgs<RouteName extends keyof AppStackParamList> =
    undefined extends AppStackParamList[RouteName]
        ? [params?: AppStackParamList[RouteName]]
        : // eslint-disable-next-line @typescript-eslint/no-empty-object-type
          {} extends AppStackParamList[RouteName]
          ? [params?: AppStackParamList[RouteName]]
          : [params: AppStackParamList[RouteName]]

type NavigationMethod = <RouteName extends keyof AppStackParamList>(
    screen: RouteName,
    ...args: NavigationArgs<RouteName>
) => void

export type UseAppNavigation = {
    navigate: NavigationMethod
    push: NavigationMethod
    replace: NavigationMethod
    goBack: () => void
    canGoBack: () => boolean
}

export function useAppNavigation(): UseAppNavigation {
    const navigation = useNavigation<AppNavigationProp>()

    return {
        navigate: navigation.navigate as NavigationMethod,
        push: navigation.push as NavigationMethod,
        replace: navigation.replace as NavigationMethod,
        goBack: navigation.goBack,
        canGoBack: navigation.canGoBack,
    }
}
