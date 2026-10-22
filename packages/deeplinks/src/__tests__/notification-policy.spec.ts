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

import { describe, expect, it } from 'vitest'

import { isNotificationAllowedDeeplinkType } from '../notification-policy'
import { DeeplinkType } from '../links'

describe('isNotificationAllowedDeeplinkType', () => {
    it.each([
        DeeplinkType.TRANSFER,
        DeeplinkType.RECEIVER_ACCOUNT_SELECTION,
        DeeplinkType.CHAIN_ACTION,
        DeeplinkType.WALLET_CONNECT,
        DeeplinkType.ADD_CONTACT,
        DeeplinkType.EDIT_CONTACT,
        DeeplinkType.ADD_WATCH_ACCOUNT,
        DeeplinkType.RECOVER_ADDRESS,
        DeeplinkType.PERA_WEB_IMPORT,
        // A push notification has no business opening the camera.
        DeeplinkType.SCAN,
        DeeplinkType.CLOUD_BACKUP,
        DeeplinkType.PASSPHRASE_BACKUP,
    ])('refuses %s', type => {
        expect(isNotificationAllowedDeeplinkType(type)).toBe(false)
    })

    it.each([
        DeeplinkType.HOME,
        DeeplinkType.ACCOUNT_DETAIL,
        DeeplinkType.ASSET_DETAIL,
        DeeplinkType.ASSET_INBOX,
        DeeplinkType.SIGN_REQUEST,
        DeeplinkType.ASSET_OPT_IN,
        DeeplinkType.BUY,
        DeeplinkType.INBOX,
        DeeplinkType.NOTIFICATIONS,
        DeeplinkType.PORTFOLIO,
    ])('admits %s', type => {
        expect(isNotificationAllowedDeeplinkType(type)).toBe(true)
    })

    it('refuses a type the map does not classify', () => {
        expect(isNotificationAllowedDeeplinkType('UNCLASSIFIED')).toBe(false)
    })
})
