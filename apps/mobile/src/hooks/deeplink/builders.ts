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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { ALGORAND_SCHEME } from './arc90-parser'
import { DeeplinkType } from './types'

export type BuildDeeplinkInput = {
    type: typeof DeeplinkType.SHARED_ACCOUNT_IMPORT
    address: string
}

export const buildAccountDeeplink = (account: WalletAccount): string =>
    `${ALGORAND_SCHEME}${account.address}`

export const buildDeeplink = (input: BuildDeeplinkInput): string => {
    switch (input.type) {
        case DeeplinkType.SHARED_ACCOUNT_IMPORT: {
            const encodedAddress = encodeURIComponent(input.address)
            return `perawallet://app/shared-account-import/?address=${encodedAddress}`
        }
    }
}
