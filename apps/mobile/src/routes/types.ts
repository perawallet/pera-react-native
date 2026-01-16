import { NavigatorScreenParams } from '@react-navigation/native'
import { OnboardingStackParamList } from '@modules/onboarding/routes/types'
import { TabBarStackParamList } from '@routes/tabbar'
import { SettingsStackParamsList } from '@modules/settings/routes'
import { ContactsStackParamsList } from '@modules/contacts/routes'

export type RootStackParamList = {
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>
  TabBar: NavigatorScreenParams<TabBarStackParamList>
  Notifications: undefined
  Settings: NavigatorScreenParams<SettingsStackParamsList>
  Contacts: NavigatorScreenParams<ContactsStackParamsList>
  Staking: undefined
}
