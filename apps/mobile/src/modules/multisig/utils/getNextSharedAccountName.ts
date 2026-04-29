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

import {
    isMultisigAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

export const getNextSharedAccountName = (
    accounts: WalletAccount[],
    baseName: string,
    excludeAddress?: string,
): string => {
    const relevant = excludeAddress
        ? accounts.filter(a => a.address !== excludeAddress)
        : accounts
    const taken = new Set(
        relevant.map(a => (a.name ?? '').trim().toLowerCase()),
    )
    const sharedCount = relevant.filter(isMultisigAccount).length
    let n = sharedCount + 1
    while (taken.has(`${baseName} #${n}`.toLowerCase())) n++
    return `${baseName} #${n}`
}
