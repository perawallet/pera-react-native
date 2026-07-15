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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'

/**
 * Test double for `useAuthorizeCardDelegation().authorizeDelegation` that skips
 * the consent + PIN gate and runs the delegate directly — so specs can exercise
 * the delegation wire without driving the gate (which has its own unit tests).
 */
export const passThroughAuthorizeDelegation = async (
    account: WalletAccount,
    delegate: (account: WalletAccount) => Promise<void>,
): Promise<boolean> => {
    await delegate(account)
    return true
}
