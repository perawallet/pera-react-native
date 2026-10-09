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

/** Each chain entry's address and the custom name are the only stored fields
 *  the backup's address payloads carry for every account type. Rekey data is
 *  deliberately absent: account polling rewrites it, and reacting to that would
 *  sync on a timer the user never touched. */
export const accountFingerprint = (
    accounts: readonly WalletAccount[],
): string =>
    accounts
        .map(account =>
            JSON.stringify([
                account.address ?? '',
                account.name ?? '',
                Object.entries(account.chains ?? {})
                    .map(([chainId, entry]) => `${chainId}:${entry?.address}`)
                    .sort(),
            ]),
        )
        .sort()
        .join('\n')
