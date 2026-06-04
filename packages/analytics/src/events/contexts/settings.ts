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

import { AnalyticsMetadataKey as Key } from '../metadata-keys'

/** Settings screen actions. */
export enum SettingsEvent {
    ChangeCurrency = 'currency_change', // Changed the display currency (currency id)
    ChangeLanguage = 'language_change', // Changed the app language
    ChangeNotificationFilter = 'notification_filter_change', // Changed notification setting for an account (address, on/off)
    PassKey = 'settingsscr_passkeys_tap', // Opened passkeys in settings
}

export interface SettingsRequiredPayloads {
    [SettingsEvent.ChangeCurrency]: {
        [Key.Id]: string
    }
    [SettingsEvent.ChangeNotificationFilter]: {
        [Key.AccountAddress]: string
        [Key.AllowNotifications]: boolean
    }
}
