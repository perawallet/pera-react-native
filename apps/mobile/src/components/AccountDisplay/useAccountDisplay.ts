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
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    addressOn,
    useAccountChainId,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { useNfdForAddressQuery } from '@perawallet/wallet-core-nfd'
import { useShouldPromptMnemonicBackup } from '@perawallet/wallet-core-backup'
import { useAccountTypeLabel } from '@hooks/useAccountTypeLabel'
import { useAccountName } from '@hooks/useAccountName'
import { useHomeChainScope } from '@hooks/useHomeChainScope'

import type { AccountIconSize } from '@components/AccountIcon'

type UseAccountDisplayParams = {
    account: Optional<WalletAccount>
    compact: boolean
    showAccountType: boolean
    alwaysShowAccountType?: boolean
    iconSize: AccountIconSize
    chainId?: ChainId
}

type UseAccountDisplayResult = {
    /** The chain whose name and address the labels show. */
    chainId: ChainId
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
    alwaysShowAccountType = false,
    iconSize,
    chainId,
}: UseAccountDisplayParams): UseAccountDisplayResult => {
    const accountChainId = useAccountChainId(
        account,
        useHomeChainScope().chainId,
    )
    const scope = useSelectedScope(chainId ?? accountChainId)
    const fullAddress = account ? addressOn(account, scope) : undefined
    const { getAccountName } = useAccountName()
    const displayName = useMemo(
        () => getAccountName(account ?? null, scope.chainId),
        [getAccountName, account, scope.chainId],
    )
    // Truncate with the same codec as the name's address fallback, so an account shown by its address has displayName equal to `address`.
    const address = useMemo(() => {
        if (!account) return undefined
        const { chainId } = scope
        return addressCodecs.has(chainId)
            ? addressCodecs.get(chainId).truncate(fullAddress ?? '')
            : fullAddress
    }, [account, fullAddress, scope])

    const { data: nfdNames } = useNfdForAddressQuery(scope, fullAddress ?? '', {
        enabled: !!fullAddress,
    })

    const nfdName = useMemo(() => nfdNames?.at(0)?.name, [nfdNames])

    const { label: accountTypeLabel } = useAccountTypeLabel(account)

    const hasName = Boolean(nfdName) || displayName !== address
    const showTypeAsSecondary =
        (alwaysShowAccountType || (showAccountType && !hasName)) &&
        Boolean(accountTypeLabel)
    const rawSecondary = showTypeAsSecondary
        ? accountTypeLabel
        : (nfdName ?? address)
    // Suppress the secondary line when it would just repeat the primary name
    // (e.g. a custom name identical to its NFD). Not in `compact`, where the
    // primary is hidden and the secondary stands alone as the only label.
    const dedupedSecondary = dedupeSecondaryLabel(displayName, rawSecondary)
    const secondaryText = compact ? rawSecondary : dedupedSecondary
    const renderSecondary = compact || Boolean(dedupedSecondary)

    const ownScope = useSelectedScope(accountChainId)
    const shouldPromptBackup = useShouldPromptMnemonicBackup(account, ownScope)
    // Every non-`sm` account-icon size renders the 40px round-icon format
    // (the account-selector size); `sm` is the 24px format, too small for a
    // legible badge.
    const showBackupBadge = shouldPromptBackup && iconSize !== 'sm'

    return {
        chainId: scope.chainId,
        displayName,
        secondaryText,
        renderSecondary,
        showTypeAsSecondary,
        showBackupBadge,
    }
}
