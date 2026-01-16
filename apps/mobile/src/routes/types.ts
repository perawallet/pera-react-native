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

import { NavigatorScreenParams } from '@react-navigation/native'
import { OnboardingStackParamList } from '@modules/onboarding/routes/types'
import { TabBarStackParamList } from '@routes/tabbar'
import { SettingsStackParamsList } from '@modules/settings/routes'
import { ContactsStackParamsList } from '@modules/contacts/routes'
import { AccountStackParamsList } from '@modules/accounts/routes/types'

export type RootStackParamList = {
    Onboarding: NavigatorScreenParams<OnboardingStackParamList>
    TabBar: NavigatorScreenParams<TabBarStackParamList>
    Notifications: undefined
    Settings: NavigatorScreenParams<SettingsStackParamsList>
    Contacts: NavigatorScreenParams<ContactsStackParamsList>
    Staking: undefined
}

export type AppStackParamList = RootStackParamList &
    OnboardingStackParamList &
    TabBarStackParamList &
    SettingsStackParamsList &
    ContactsStackParamsList &
    AccountStackParamsList
