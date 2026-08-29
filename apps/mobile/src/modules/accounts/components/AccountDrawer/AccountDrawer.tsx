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
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import { PWDrawer } from '@components/core'
import { routeCapabilities } from '@routes/capabilities'

import { AccountDrawerContent } from './AccountDrawerContent'
import {
    AccountDrawerContext,
    type AccountDrawerContextValue,
} from './AccountDrawerContext'
import { useAccountDrawer } from './useAccountDrawer'
import { useAccountPickers, type AccountPickerKind } from './useAccountPickers'

export type AccountDrawerProps = {
    children: ReactNode
}

const AccountDrawerHost = ({ children }: AccountDrawerProps) => {
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

    return (
        <AccountDrawerContext.Provider value={controls}>
            <PWDrawer
                isOpen={isOpen}
                // Reporting only: the gestures inside PWDrawer settle progress
                // themselves, so animating again here would restart their spring.
                onOpen={markOpen}
                onClose={markClosed}
                renderContent={renderContent}
                variant='back'
                progress={progress}
                // Every screen that can open this drives it from a PWPager pan;
                // an edge gesture here would both compete with those and claim
                // the platform back-swipe for the entire tab shell.
                hasOwnOpenGesture={false}
            >
                {children}
            </PWDrawer>
        </AccountDrawerContext.Provider>
    )
}

/**
 * Mounts the account switcher as a drawer beneath the whole tab shell.
 *
 * Wraps the tab navigator rather than each screen, so the panel spans the full
 * screen height and the tab bar — being inside the sliding content — travels
 * with it rather than needing to be animated separately.
 *
 * Safe at this level only because there is no gesture surface here: the drag
 * lives in each screen's PWPager, so nothing claims the left edge and the
 * platform back-swipe survives for screens pushed inside the tabs. That was the
 * reason an earlier version had to be mounted per screen.
 *
 * Screens declare how they want the list shaped with
 * `useAccountDrawerPickerKind`. Only screens with a pager can open it, which is
 * what keeps it to the ones carrying an account selector.
 *
 * With the capability off it stays out of the tree entirely, so no context is
 * published and the selection trigger falls back to the bottom sheet.
 */
export const AccountDrawer = ({ children }: AccountDrawerProps) => {
    if (!routeCapabilities.accountDrawer) return <>{children}</>

    return <AccountDrawerHost>{children}</AccountDrawerHost>
}
