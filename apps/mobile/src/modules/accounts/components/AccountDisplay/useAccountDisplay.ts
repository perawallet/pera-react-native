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

import { useMemo } from 'react'
import {
    dedupeSecondaryLabel,
    truncateAlgorandAddress,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    getAccountDisplayName,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useNfdForAddressQuery } from '@perawallet/wallet-core-nfd'
import { useShouldPromptMnemonicBackup } from '@perawallet/wallet-core-backup'
import { useAccountTypeLabel } from '@modules/accounts/hooks/useAccountTypeLabel'

import type { AccountIconSize } from '../AccountIcon'

type UseAccountDisplayParams = {
    account: Optional<WalletAccount>
    compact: boolean
    showAccountType: boolean
    iconSize: AccountIconSize
}

type UseAccountDisplayResult = {
    displayName: string
    secondaryText: Optional<string>
    renderSecondary: boolean
    showTypeAsSecondary: boolean
    showBackupBadge: boolean
}

/** Derives the primary/secondary labels an account renders with. */
export const useAccountDisplay = ({
    account,
    compact,
    showAccountType,
    iconSize,
}: UseAccountDisplayParams): UseAccountDisplayResult => {
    const displayName = useMemo(
        () => (account ? getAccountDisplayName(account) : 'No Account'),
        [account],
    )
    const address = useMemo(
        () => (account ? truncateAlgorandAddress(account?.address) : undefined),
        [account],
    )

    const { data: nfdNames } = useNfdForAddressQuery(account?.address ?? '', {
        enabled: !!account?.address,
    })

    const nfdName = useMemo(() => nfdNames?.at(0)?.name, [nfdNames])

    const { label: accountTypeLabel } = useAccountTypeLabel(account)

    const hasName = Boolean(nfdName) || displayName !== address
    const showTypeAsSecondary =
        showAccountType && !hasName && Boolean(accountTypeLabel)
    const rawSecondary = showTypeAsSecondary
        ? accountTypeLabel
        : (nfdName ?? address)
    // Suppress the secondary line when it would just repeat the primary name
    // (e.g. a custom name identical to its NFD). Not in `compact`, where the
    // primary is hidden and the secondary stands alone as the only label.
    const dedupedSecondary = dedupeSecondaryLabel(displayName, rawSecondary)
    const secondaryText = compact ? rawSecondary : dedupedSecondary
    const renderSecondary = compact || Boolean(dedupedSecondary)

    const shouldPromptBackup = useShouldPromptMnemonicBackup(account)
    // Every non-`sm` account-icon size renders the 40px round-icon format
    // (the account-selector size); `sm` is the 24px format, too small for a
    // legible badge.
    const showBackupBadge = shouldPromptBackup && iconSize !== 'sm'

    return {
        displayName,
        secondaryText,
        renderSecondary,
        showTypeAsSecondary,
        showBackupBadge,
    }
}
