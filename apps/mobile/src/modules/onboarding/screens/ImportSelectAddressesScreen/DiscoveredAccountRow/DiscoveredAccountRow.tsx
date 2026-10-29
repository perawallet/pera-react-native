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
import { Trans } from 'react-i18next'
import type { LocalAccount } from '@perawallet/wallet-core-accounts'
import { PWText, PWView } from '@components/core'
import { AccountIcon } from '@components/AccountIcon'
import { PreferredAmount } from '@components/PreferredAmount'
import { useLanguage } from '@hooks/useLanguage'
import { SelectableAccountCheckboxRow } from '@modules/accounts'
import { ChainIconStack } from '@modules/chain-ui/icon'
import { useDiscoveredAccountRow } from './useDiscoveredAccountRow'
import { useStyles } from './styles'

export type DiscoveredAccountRowProps = {
    account: LocalAccount
    isSelected: boolean
    isImported: boolean
    onToggle: (accountId: string) => void
}

export const DiscoveredAccountRow = ({
    account,
    isSelected,
    isImported,
    onToggle,
}: DiscoveredAccountRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { title, addressLines, total, testAddress } =
        useDiscoveredAccountRow(account)
    const handleToggle = useCallback(
        () => onToggle(account.id),
        [onToggle, account.id],
    )

    return (
        <SelectableAccountCheckboxRow
            title={title}
            leadingIcon={<AccountIcon account={account} />}
            isSelected={isSelected}
            isImported={isImported}
            importedLabel={t(
                'onboarding.import_select_addresses.already_imported',
            )}
            onToggle={handleToggle}
            testID={`import_select_addresses_item_${testAddress}`}
            checkboxTestID={`import_select_addresses_item_checkbox_${testAddress}`}
            details={
                <PWView style={styles.details}>
                    {addressLines.map(line => (
                        <PWView
                            key={line.address}
                            style={styles.addressLine}
                            testID={`import_select_addresses_address_${line.address}`}
                        >
                            <PWText
                                variant='footnoteMedium'
                                weight={400}
                                style={styles.text}
                            >
                                {line.displayAddress}
                            </PWText>
                            <ChainIconStack chainIds={line.chainIds} />
                        </PWView>
                    ))}
                    {total.kind === 'fiat' && (
                        <PWText
                            variant='footnoteMedium'
                            style={styles.text}
                            testID={`import_select_addresses_total_${testAddress}`}
                        >
                            <Trans
                                i18nKey='onboarding.import_select_addresses.total_value'
                                components={[
                                    <PreferredAmount
                                        key='total'
                                        value={total.value}
                                        density='compact'
                                        variant='footnoteMedium'
                                        isInline
                                    />,
                                ]}
                            />
                        </PWText>
                    )}
                </PWView>
            }
        />
    )
}
