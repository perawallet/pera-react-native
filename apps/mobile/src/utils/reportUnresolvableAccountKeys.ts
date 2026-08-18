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

import { logger } from '@perawallet/wallet-core-shared'

// Watch-only, hardware and multisig accounts have no keyPairId and are
// expected to have no keystore record — only accounts that claim a key are
// candidates for this check.
export const reportUnresolvableAccountKeys = ({
    accounts,
    keyIds,
}: {
    accounts: { id: string; keyPairId?: string }[]
    keyIds: Set<string>
}): string[] => {
    const orphans = accounts
        .filter(
            account =>
                account.keyPairId !== undefined &&
                !keyIds.has(account.keyPairId),
        )
        .map(account => account.id)

    if (orphans.length > 0) {
        logger.warn('Accounts with no resolvable keystore record', {
            count: orphans.length,
            accountIds: orphans,
        })
    }

    return orphans
}
