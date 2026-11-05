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

import { useState } from 'react'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useUniqueAccountName } from '@hooks/useUniqueAccountName'

export type UseRenameAccountContentResult = {
    name: string
    nameError: Optional<string>
    isSaveDisabled: boolean
    handleNameChange: (value: string) => void
    /** Resolves the sheet with the trimmed name; does nothing while Save is disabled. */
    handleSave: () => void
}

export const useRenameAccountContent = (
    accountId: string,
): UseRenameAccountContentResult => {
    const { t } = useLanguage()
    const account = useAccountsStore(s =>
        s.accounts.find(a => a.id === accountId),
    )
    const { isAccountNameTaken } = useUniqueAccountName()
    const { resolve } = useBottomSheetResult<string>()
    const [name, setName] = useState(account?.name ?? '')

    const trimmed = name.trim()
    const isNameTaken = isAccountNameTaken(trimmed, accountId)
    const nameError = isNameTaken ? t('account_info.name_taken') : undefined
    const isSaveDisabled = trimmed.length === 0 || isNameTaken

    const handleSave = () => {
        if (isSaveDisabled) return
        resolve(trimmed)
    }

    return {
        name,
        nameError,
        isSaveDisabled,
        handleNameChange: setName,
        handleSave,
    }
}
