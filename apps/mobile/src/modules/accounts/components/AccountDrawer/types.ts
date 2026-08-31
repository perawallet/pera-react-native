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

import { type ReactNode } from 'react'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'

/**
 * Shapes the account list. The same object is spread into a screen's
 * `AccountSelection`, so the drawer and the bottom-sheet fallback can't drift
 * into offering different accounts — on Swap and Fund the filter is what keeps
 * unusable accounts out of the list.
 */
export type AccountDrawerPickerProps = {
    headerContent?: ReactNode
    hideDefaultHeader?: boolean
    showSearch?: boolean
    accountFilter?: (account: WalletAccount) => boolean
    showPeraCardActivation?: boolean
    onSelected?: (account: WalletAccount) => void
}
