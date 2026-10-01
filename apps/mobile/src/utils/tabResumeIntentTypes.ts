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

/**
 * What a flow needs to reopen in a browser tab when the toolbar popup can't
 * finish it (a Bluetooth Ledger can only be reached from a tab). Amounts are
 * display-unit strings: the record crosses `chrome.storage.session`, and
 * `Decimal` doesn't survive JSON.
 */
export type TabResumeIntent =
    | {
          flow: 'swap'
          accountAddress: string
          assetInId: string
          assetOutId: string
          payAmount: string
      }
    | {
          flow: 'send'
          accountAddress: string
          assetId: string
          destination: string
          amount: string
          note?: string
      }
