/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import {
    useSelectedAccountAddress,
    useSigningAccounts,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    PWButton,
    PWFlatList,
    PWRadioButton,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type SelectAccountContentProps = {
    /** Signaling host (relay) — shown as the connection endpoint, not the dApp. */
    host: string
    onSelect: (address: string) => void
    onReject: () => void
}

/**
 * Step 1 of the Liquid Auth connection flow: pick the single account to bind
 * into the FIDO credential. The real dApp identity is not yet known (it arrives
 * during negotiation), so this step is framed as a plain account picker with
 * the relay host shown as the connection endpoint, not the peer.
 */
export const SelectAccountContent = ({
    host,
    onSelect,
    onReject,
}: SelectAccountContentProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const accounts = useSigningAccounts()
    const { selectedAccountAddress } = useSelectedAccountAddress()

    // Default to the active account when it can sign, else the first signer.
    const defaultAddress =
        accounts.find(account => account.address === selectedAccountAddress)
            ?.address ??
        accounts[0]?.address ??
        null
    const [selected, setSelected] = useState<string | null>(defaultAddress)

    const renderAccountRow = ({ item }: { item: WalletAccount }) => (
        <PWTouchableOpacity
            style={styles.accountItem}
            onPress={() => setSelected(item.address)}
        >
            <AccountDisplay
                account={item}
                showChevron={false}
            />
            <PWRadioButton
                isSelected={selected === item.address}
                onPress={() => setSelected(item.address)}
            />
        </PWTouchableOpacity>
    )

    const ListHeader = (
        <PWView style={styles.header}>
            <PWText
                variant='h3'
                style={styles.title}
            >
                {t('liquidauth.request.select_account_title')}
            </PWText>
            <PWText style={styles.subtitle}>
                {t('liquidauth.request.host_label', { host })}
            </PWText>
        </PWView>
    )

    return (
        <>
            <PWFlatList
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
                data={accounts}
                renderItem={renderAccountRow}
                extraData={selected}
                ListHeaderComponent={ListHeader}
                showsVerticalScrollIndicator={false}
                inBottomSheet
            />
            <PWView style={styles.buttonContainer}>
                <PWButton
                    variant='secondary'
                    title={t('common.cancel.label')}
                    onPress={onReject}
                    style={styles.cancelButton}
                />
                <PWButton
                    variant='primary'
                    title={t('liquidauth.request.select')}
                    onPress={() => selected && onSelect(selected)}
                    style={styles.selectButton}
                    isDisabled={!selected}
                />
            </PWView>
        </>
    )
}
