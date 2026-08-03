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
    type NativeStackHeaderProps,
    type NativeStackNavigationOptions,
} from '@react-navigation/native-stack'
import { NavigationHeader } from '@components/NavigationHeader'

/**
 * Screen options for a root-level destination that shows the shared
 * `NavigationHeader`. `title` is an i18n key; `NavigationHeader` translates it.
 */
export const headeredScreen = (
    title: string,
): NativeStackNavigationOptions => ({
    headerShown: true,
    title,
    header: (props: NativeStackHeaderProps) => <NavigationHeader {...props} />,
})
