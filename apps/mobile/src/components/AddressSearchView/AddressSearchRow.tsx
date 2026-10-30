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

import type { ReactNode } from 'react'
import { addressOn } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { PasteFromClipboardRow } from './PasteFromClipboardRow'
import { AccountResultRow } from './AccountResultRow'
import { useStyles } from './styles'
import type { AddressSearchItem } from './useAddressSearchView'

type AddressSearchRowProps = {
    item: AddressSearchItem
    scope: ChainScope
    onSelected: (address: string, nfdName?: string) => void
    setValue: (value: string) => void
    /** Shown after selected addresses; the balance row badges itself. */
    chainBadge: ReactNode
    showAccountBalance: boolean
    showAddIcon: boolean
}

export const AddressSearchRow = ({
    item,
    scope,
    onSelected,
    setValue,
    chainBadge,
    showAccountBalance,
    showAddIcon,
}: AddressSearchRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    switch (item.type) {
        case 'section_header': {
            return <PWText variant='h4'>{t(item.title)}</PWText>
        }
        case 'paste': {
            // Fills the field instead of selecting outright, matching
            // native: the user still confirms the pasted address.
            return (
                <PasteFromClipboardRow
                    address={item.address}
                    onPress={setValue}
                />
            )
        }
        case 'contact': {
            return (
                <PWTouchableOpacity onPress={() => onSelected(item.address)}>
                    <AddressDisplay
                        scope={scope}
                        address={item.address}
                        showCopy={false}
                        trailing={chainBadge}
                        style={styles.accountDisplay}
                    />
                </PWTouchableOpacity>
            )
        }
        case 'account': {
            const address = addressOn(item.account, scope) ?? ''
            return (
                <PWTouchableOpacity
                    onPress={() => onSelected(address)}
                    testID={`account_result_row_${address}`}
                >
                    <AccountResultRow
                        account={item.account}
                        showBalance={showAccountBalance}
                        chainId={scope.chainId}
                        badges={chainBadge}
                    />
                </PWTouchableOpacity>
            )
        }
        case 'address': {
            return (
                <PWTouchableOpacity
                    onPress={() => onSelected(item.address)}
                    style={showAddIcon ? styles.foreignRow : undefined}
                >
                    <AddressDisplay
                        scope={scope}
                        address={item.address}
                        showCopy={false}
                        forceShowIcon
                        style={
                            showAddIcon
                                ? styles.accountDisplayInRow
                                : styles.accountDisplay
                        }
                    />
                    {showAddIcon && (
                        <PWView
                            style={styles.addIconButton}
                            testID='address-search-add-icon'
                        >
                            <PWIcon
                                name='plus'
                                variant='helper'
                                size='sm'
                            />
                        </PWView>
                    )}
                </PWTouchableOpacity>
            )
        }
        case 'nfd': {
            return (
                <PWTouchableOpacity
                    onPress={() => onSelected(item.nfd.address, item.nfd.name)}
                    style={showAddIcon ? styles.foreignRow : styles.nfdItem}
                >
                    <AddressDisplay
                        scope={scope}
                        address={item.nfd.address}
                        showCopy={false}
                        style={
                            showAddIcon
                                ? styles.accountDisplayInRow
                                : styles.accountDisplay
                        }
                    />
                    {showAddIcon && (
                        <PWView
                            style={styles.addIconButton}
                            testID='address-search-add-icon'
                        >
                            <PWIcon
                                name='plus'
                                variant='helper'
                                size='sm'
                            />
                        </PWView>
                    )}
                </PWTouchableOpacity>
            )
        }
    }
}
