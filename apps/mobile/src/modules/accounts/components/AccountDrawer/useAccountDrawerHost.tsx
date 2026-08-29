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

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { type SharedValue } from 'react-native-reanimated'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'

import { AccountDrawerContent } from './AccountDrawerContent'
import { type AccountDrawerContextValue } from './AccountDrawerContext'
import { useAccountDrawer } from './useAccountDrawer'
import { useAccountPickers, type AccountPickerKind } from './useAccountPickers'

export type UseAccountDrawerHostResult = {
    isOpen: boolean
    progress: SharedValue<number>
    controls: AccountDrawerContextValue
    markOpen: () => void
    markClosed: () => void
    renderContent: () => ReactNode
}

export const useAccountDrawerHost = (): UseAccountDrawerHostResult => {
    const {
        isOpen,
        progress,
        openDrawer,
        closeDrawer,
        markOpen,
        markClosed,
        handleSelected,
        handleAddAccount,
        handleSearch,
        handlePeraCardActivate,
        handlePeraCardOpen,
        handleOpenSort,
    } = useAccountDrawer()

    const [pickerKind, setPickerKind] = useState<AccountPickerKind>('portfolio')
    const pickers = useAccountPickers()
    const picker = pickers[pickerKind]

    const publishPickerKind = useCallback(
        (kind: AccountPickerKind) => setPickerKind(kind),
        [],
    )

    const controls = useMemo<AccountDrawerContextValue>(
        () => ({
            isOpen,
            openDrawer,
            closeDrawer,
            progress,
            pickerKind,
            publishPickerKind,
        }),
        [
            isOpen,
            openDrawer,
            closeDrawer,
            progress,
            pickerKind,
            publishPickerKind,
        ],
    )

    const handleAccountSelected = useCallback(
        (account: WalletAccount) => {
            handleSelected()
            picker.onSelected?.(account)
        },
        [handleSelected, picker],
    )

    const renderContent = useCallback(
        () => (
            <AccountDrawerContent
                onSelected={handleAccountSelected}
                onAddAccount={handleAddAccount}
                onSearch={handleSearch}
                onOpenSort={handleOpenSort}
                onPeraCardActivate={handlePeraCardActivate}
                onPeraCardOpen={handlePeraCardOpen}
                headerContent={picker.headerContent}
                hideDefaultHeader={picker.hideDefaultHeader}
                showSearch={picker.showSearch}
                accountFilter={picker.accountFilter}
                showPeraCardActivation={picker.showPeraCardActivation}
            />
        ),
        [
            handleAccountSelected,
            handleAddAccount,
            handleSearch,
            handleOpenSort,
            handlePeraCardActivate,
            handlePeraCardOpen,
            picker,
        ],
    )

    return {
        isOpen,
        progress,
        controls,
        markOpen,
        markClosed,
        renderContent,
    }
}
