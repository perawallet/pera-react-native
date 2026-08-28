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

import { useCallback, useMemo, type ReactNode } from 'react'
import { useSharedValue } from 'react-native-reanimated'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import { PWDrawer } from '@components/core'
import { routeCapabilities } from '@routes/capabilities'

import { AccountDrawerContent } from './AccountDrawerContent'
import {
    AccountDrawerContext,
    type AccountDrawerContextValue,
} from './AccountDrawerContext'
import { useAccountDrawer } from './useAccountDrawer'

/**
 * Shapes the account list exactly as `AccountSelection`'s bottom sheet would.
 * A screen declares this once and spreads it into both, so the drawer and the
 * trigger can't drift into offering different accounts — on Swap and Fund the
 * filter is what keeps unusable accounts out of the list.
 */
export type AccountDrawerPickerProps = {
    headerContent?: ReactNode
    hideDefaultHeader?: boolean
    showSearch?: boolean
    accountFilter?: (account: WalletAccount) => boolean
    showPeraCardActivation?: boolean
    onSelected?: (account: WalletAccount) => void
}

export type AccountDrawerProps = AccountDrawerPickerProps & {
    children: ReactNode
    /**
     * Set when the wrapped screen already sits inside a safe-area layout
     * (`safeAreaLayout`, `headeredLayout`). `useSafeAreaInsets` still reports the
     * full window inset to descendants regardless, so without this the panel
     * adds a top inset the host has already paid for.
     */
    isWithinSafeArea?: boolean
    /**
     * Set false when a PWPager on the screen drives the drawer from its own pan.
     * The drawer then publishes its progress and stops running an opening
     * gesture of its own.
     */
    hasOwnOpenGesture?: boolean
}

const AccountDrawerHost = ({
    children,
    isWithinSafeArea,
    hasOwnOpenGesture,
    headerContent,
    hideDefaultHeader,
    showSearch,
    accountFilter,
    showPeraCardActivation,
    onSelected,
}: AccountDrawerProps) => {
    const {
        isOpen,
        openDrawer,
        closeDrawer,
        handleSelected,
        handleAddAccount,
        handleSearch,
        handlePeraCardActivate,
        handlePeraCardOpen,
        handleOpenSort,
    } = useAccountDrawer()

    // Owned here rather than inside PWDrawer so it can be published to the
    // screen, letting a pager drive the drawer from the same pan.
    const progress = useSharedValue(0)

    const controls = useMemo<AccountDrawerContextValue>(
        () => ({ isOpen, openDrawer, closeDrawer, progress }),
        [isOpen, openDrawer, closeDrawer, progress],
    )

    const handleAccountSelected = useCallback(
        (account: WalletAccount) => {
            handleSelected()
            onSelected?.(account)
        },
        [handleSelected, onSelected],
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
                headerContent={headerContent}
                hideDefaultHeader={hideDefaultHeader}
                showSearch={showSearch}
                accountFilter={accountFilter}
                showPeraCardActivation={showPeraCardActivation}
                isWithinSafeArea={isWithinSafeArea}
            />
        ),
        [
            handleAccountSelected,
            handleAddAccount,
            handleSearch,
            handleOpenSort,
            handlePeraCardActivate,
            handlePeraCardOpen,
            headerContent,
            hideDefaultHeader,
            showSearch,
            accountFilter,
            showPeraCardActivation,
            isWithinSafeArea,
        ],
    )

    return (
        <AccountDrawerContext.Provider value={controls}>
            <PWDrawer
                isOpen={isOpen}
                onOpen={openDrawer}
                onClose={closeDrawer}
                renderContent={renderContent}
                variant='back'
                progress={progress}
                hasOwnOpenGesture={hasOwnOpenGesture}
            >
                {children}
            </PWDrawer>
        </AccountDrawerContext.Provider>
    )
}

/**
 * Mounts the account switcher as a left-edge drawer over whatever it wraps.
 *
 * Wrap the individual screen, never a navigator: the drag surface occupies the
 * same left edge as the platform back-swipe, so anything pushed inside the
 * wrapped subtree would lose it. Home works because only `AccountScreen` — the
 * root of its stack, with nothing to go back to — is wrapped.
 *
 * With the capability off it stays out of the tree entirely, so no context is
 * published and the selection trigger falls back to the bottom sheet.
 */
export const AccountDrawer = ({
    children,
    ...hostProps
}: AccountDrawerProps) => {
    if (!routeCapabilities.accountDrawer) return <>{children}</>

    return <AccountDrawerHost {...hostProps}>{children}</AccountDrawerHost>
}
