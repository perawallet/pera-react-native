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

import type { LedgerAppProfile } from '@perawallet/wallet-extension-ledger-shared'

export const ETHEREUM_LEDGER_APP: LedgerAppProfile = {
    appName: 'Ethereum',
    // The app rejects with the standard 0x6985, so it adds no word of its own.
    userRejectedStatusCodes: [],
    // The generic INCORRECT_DATA word, which this app answers when blind
    // signing or contract data is off.
    blindSigningRequiredStatusCodes: [0x6a_80],
}
