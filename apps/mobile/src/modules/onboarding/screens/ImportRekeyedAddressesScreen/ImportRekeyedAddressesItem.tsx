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

import { useCallback } from 'react'
import { PWRoundIcon } from '@components/core'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { SelectableAccountCheckboxRow } from '@modules/accounts/components/SelectableAccountCheckboxRow'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheet } from '@modules/bottom-sheet'
import { RekeyedAccountInfoContent } from './RekeyedAccountInfoContent'

type ImportRekeyedAddressesItemProps = {
    account: WalletAccount
    isImported: boolean
    isSelected: boolean
    onToggle: (address: string) => void
}

export const ImportRekeyedAddressesItem = ({
    account,
    isImported,
    isSelected,
    onToggle,
}: ImportRekeyedAddressesItemProps) => {
    const { t } = useLanguage()
    const { request: requestBottomSheet } = useBottomSheet()

    const handleOpenInfo = useCallback(() => {
        void requestBottomSheet<void>({
            contents: <RekeyedAccountInfoContent account={account} />,
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet, account])

    const handleToggle = useCallback(
        () => onToggle(account.address),
        [onToggle, account.address],
    )

    return (
        <SelectableAccountCheckboxRow
            title={truncateAlgorandAddress(account.address)}
            titleCopyValue={account.address}
            subtitle={t(
                'onboarding.import_rekeyed_addresses.rekeyed_account_subtitle',
            )}
            leadingIcon={
                <PWRoundIcon
                    icon='account-rekeyed'
                    variant='helper'
                    size='md'
                />
            }
            isSelected={isSelected}
            isImported={isImported}
            importedLabel={t(
                'onboarding.import_rekeyed_addresses.already_imported',
            )}
            onToggle={handleToggle}
            onInfoPress={handleOpenInfo}
            testID={`import_rekeyed_addresses_item_${account.address}`}
            checkboxTestID={`import_rekeyed_addresses_item_checkbox_${account.address}`}
            infoTestID={`import_rekeyed_addresses_item_info_${account.address}`}
        />
    )
}
