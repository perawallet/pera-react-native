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

import { useCallback, type ReactNode } from 'react'
import {
    useSelectedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useStyles } from './styles'
import {
    AccountMenuContent,
    type AccountMenuContentResult,
} from '@modules/accounts/components/AccountMenuContent'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useAccountDrawerControls } from '@modules/accounts/components/AccountDrawer'
import { useAccountSwitcherActions } from '@modules/accounts/hooks/useAccountSwitcherActions'
import {
    type StyleProp,
    type TouchableOpacityProps,
    type ViewStyle,
} from 'react-native'
import { AccountDisplay, type AccountDisplayCard } from '../AccountDisplay'
import { type AccountIconProps } from '../AccountIcon'
import {
    type PWIconProps,
    type PWTextProps,
    PWTouchableOpacity,
} from '@components/core'
import { CopyableText } from '@components/CopyableText'

export type AccountSelectionProps = {
    onSelected?: (account: WalletAccount) => void
    headerContent?: ReactNode
    /**
     * When set, the trigger renders the Pera Card identity instead of the
     * selected account (the switcher still opens on tap).
     */
    card?: AccountDisplayCard
    triggerStyle?: StyleProp<ViewStyle>
    triggerIconProps?: Omit<AccountIconProps, 'account'>
    triggerChevronProps?: Partial<PWIconProps>
    triggerTextProps?: PWTextProps
    hideDefaultHeader?: boolean
    showSearch?: boolean
    accountFilter?: (account: WalletAccount) => boolean
    /** Opt in to the Pera Card activation/connected row (home switcher only). */
    showPeraCardActivation?: boolean
} & TouchableOpacityProps

export const AccountSelection = ({
    onSelected,
    headerContent,
    card,
    triggerStyle,
    triggerIconProps,
    triggerChevronProps,
    triggerTextProps,
    hideDefaultHeader,
    showSearch = false,
    accountFilter,
    showPeraCardActivation,
    ...props
}: AccountSelectionProps) => {
    const styles = useStyles()
    const account = useSelectedAccount()
    const { request: requestBottomSheet } = useBottomSheet()
    const drawerControls = useAccountDrawerControls()
    const {
        goToAddAccount,
        goToSearch,
        goToPeraCardActivation,
        openPeraCard,
        openSort,
    } = useAccountSwitcherActions()

    const openAccountMenu = useCallback(async () => {
        const result = await requestBottomSheet<AccountMenuContentResult>({
            id: 'account-selection-menu',
            contents: (
                <AccountMenuContent
                    headerContent={headerContent}
                    hideDefaultHeader={hideDefaultHeader}
                    showSearch={showSearch}
                    accountFilter={accountFilter}
                    showPeraCardActivation={showPeraCardActivation}
                />
            ),
            options: {
                size: 'modal',
                enablePanDownToClose: false,
                enableContentPanningGesture: false,
                autoCreateContainer: false,
            },
        })

        if (!result) return

        switch (result.kind) {
            case 'selected': {
                onSelected?.(result.account)
                return
            }
            case 'add-account': {
                goToAddAccount()
                return
            }
            case 'search': {
                goToSearch()
                return
            }
            case 'pera-card-activate': {
                goToPeraCardActivation()
                return
            }
            case 'pera-card-open': {
                openPeraCard()
                return
            }
            case 'sort': {
                await openSort()
                // After sorting, reopen the account menu so the user can pick.
                void openAccountMenu()
                return
            }
        }
    }, [
        requestBottomSheet,
        headerContent,
        hideDefaultHeader,
        showSearch,
        accountFilter,
        showPeraCardActivation,
        onSelected,
        goToAddAccount,
        goToSearch,
        goToPeraCardActivation,
        openPeraCard,
        openSort,
    ])

    const triggerProps = {
        ...props,
        style: [styles.trigger, props.style],
        activeOpacity: 0.8,
        // Inside the drawer's subtree the trigger opens it instead; elsewhere
        // (swap, onramp, card) there's no drawer and the sheet still opens.
        onPress: () => {
            if (drawerControls) {
                drawerControls.openDrawer()
                return
            }
            void openAccountMenu()
        },
        testID: 'account_selection_button',
    }

    const display = (
        <AccountDisplay
            account={account ?? undefined}
            card={card}
            style={[styles.container, triggerStyle]}
            iconProps={triggerIconProps}
            chevronProps={triggerChevronProps}
            textProps={triggerTextProps}
            noBorder
        />
    )

    // The Pera Card identity has no address behind it, so only the account
    // presentation gets the long-press-to-copy affordance.
    if (card || !account) {
        return (
            <PWTouchableOpacity {...triggerProps}>{display}</PWTouchableOpacity>
        )
    }

    return (
        <CopyableText
            {...triggerProps}
            copyValue={account.address}
        >
            {display}
        </CopyableText>
    )
}
