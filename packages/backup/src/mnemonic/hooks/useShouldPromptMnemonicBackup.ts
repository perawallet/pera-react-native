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

import {
    useAccountFundedNetworksQuery,
    useAccountsRekeyedTo,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useRequiresMnemonicBackup } from './useRequiresMnemonicBackup'

// The single visibility rule for backup warnings (reminder banner, account
// badge), so they can never disagree.
export const useShouldPromptMnemonicBackup = (
    account: WalletAccount | null | undefined,
): boolean => {
    const requiresBackup = useRequiresMnemonicBackup(account)
    // Funding on ANY network counts, not just the one currently selected: the
    // passphrase is the same secret whichever chain the balance sits on, and a
    // warning that disappears on a network switch teaches the wrong lesson.
    const { isFunded } = useAccountFundedNetworksQuery(account?.address)
    const rekeyedToThisAccount = useAccountsRekeyedTo(account?.address)

    // An unfunded account still holds the keys for anything rekeyed to it, so
    // losing its passphrase strands those accounts — funding is not the only
    // reason to prompt.
    return requiresBackup && (isFunded || rekeyedToThisAccount.length > 0)
}
