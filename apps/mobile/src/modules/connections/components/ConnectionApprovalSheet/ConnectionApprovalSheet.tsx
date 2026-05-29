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

import { type ComponentProps, useState } from 'react'
import {
    useSelectedAccountAddress,
    useSigningAccounts,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { AlgorandPermission } from '@perawallet/wallet-core-walletconnect'
import {
    PWBadge,
    PWButton,
    PWCheckbox,
    PWFlatList,
    PWIcon,
    PWImage,
    PWRadioButton,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { TitledExpandablePanel } from '@components/ExpandablePanel/TitledExpandablePanel'
import { useLanguage } from '@hooks/useLanguage'
import { PermissionItem } from '../PermissionItem'
import type { ConnectionNetwork } from '../ConnectionDetailsView'
import { useStyles } from './styles'

export type ConnectionApprovalSheetProps = {
    /** Network badge(s) the dApp wants — `mainnet`, `testnet`, or both. */
    networks: ConnectionNetwork[]
    /** dApp icon URL; falls back to `fallbackIconName` if absent or unloadable. */
    iconUri?: string
    fallbackIconName: ComponentProps<typeof PWIcon>['name']
    title: string
    /** URL/host shown under the title. Rendered as a link when `onSubtitlePress` is set, else gray text. */
    subtitle?: string
    onSubtitlePress?: () => void
    permissions: AlgorandPermission[]
    /** "SELECT ACCOUNT(S)" header above the account list. */
    accountsTitle: string
    /**
     * `single` (Liquid Auth — one account is bound into the FIDO credential,
     * defaulting to the active signer) or `multi` (WalletConnect).
     */
    mode: 'single' | 'multi'
    onApprove: (addresses: string[]) => void
    onReject: () => void
}

/**
 * Shared pre-connection approval sheet for every connection protocol. The
 * protocol supplies its identity (icon, title, URL/host), requested networks
 * and permissions, and the selection `mode`; the scaffold — network badges,
 * icon-with-fallback, the Advanced Permissions panel, the account picker, and
 * the Cancel/Connect actions — is identical.
 */
export const ConnectionApprovalSheet = ({
    networks,
    iconUri,
    fallbackIconName,
    title,
    subtitle,
    onSubtitlePress,
    permissions,
    accountsTitle,
    mode,
    onApprove,
    onReject,
}: ConnectionApprovalSheetProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const accounts = useSigningAccounts()
    const { selectedAccountAddress } = useSelectedAccountAddress()
    const [iconFailed, setIconFailed] = useState(false)

    // Single mode defaults to the active account when it can sign, else the first signer.
    const defaultAddress =
        accounts.find(account => account.address === selectedAccountAddress)
            ?.address ??
        accounts[0]?.address ??
        null
    const [selected, setSelected] = useState<string[]>(
        mode === 'single' && defaultAddress ? [defaultAddress] : [],
    )

    const toggleAccount = (address: string) => {
        if (mode === 'single') {
            setSelected([address])
            return
        }
        setSelected(prev =>
            prev.includes(address)
                ? prev.filter(item => item !== address)
                : [...prev, address],
        )
    }

    const renderAccountRow = ({ item }: { item: WalletAccount }) => (
        <PWTouchableOpacity
            key={item.address}
            style={styles.accountItem}
            onPress={() => toggleAccount(item.address)}
        >
            <AccountDisplay
                account={item}
                showChevron={false}
            />
            {mode === 'single' ? (
                <PWRadioButton
                    isSelected={selected.includes(item.address)}
                    onPress={() => toggleAccount(item.address)}
                />
            ) : (
                <PWCheckbox
                    checked={selected.includes(item.address)}
                    onPress={() => toggleAccount(item.address)}
                />
            )}
        </PWTouchableOpacity>
    )

    const ListHeader = (
        <PWView style={styles.headerContainer}>
            <PWView style={styles.networksContainer}>
                {networks.map(item => (
                    <PWBadge
                        key={item}
                        value={t(`walletconnect.request.networks_${item}`)}
                        variant={item === 'testnet' ? 'testnet' : 'primary'}
                    />
                ))}
            </PWView>
            {iconUri && !iconFailed ? (
                <PWImage
                    source={{ uri: iconUri }}
                    style={styles.icon}
                    onError={() => setIconFailed(true)}
                />
            ) : (
                <PWView style={styles.iconContainer}>
                    <PWIcon
                        name={fallbackIconName}
                        variant='secondary'
                        size='xl'
                    />
                </PWView>
            )}
            <PWView style={styles.titleContainer}>
                <PWText
                    variant='h3'
                    style={styles.title}
                >
                    {title}
                </PWText>
                {!!subtitle &&
                    (onSubtitlePress ? (
                        <PWButton
                            variant='link'
                            onPress={onSubtitlePress}
                            title={subtitle}
                        />
                    ) : (
                        <PWText style={styles.subtitle}>{subtitle}</PWText>
                    ))}
            </PWView>

            <TitledExpandablePanel
                containerStyle={styles.permissionsContainer}
                title={
                    <PWText
                        variant='h4'
                        style={styles.panelTitle}
                    >
                        {t('walletconnect.request.permissions_title', {
                            count: permissions.length,
                        })}
                    </PWText>
                }
            >
                <PWView style={styles.permissionsContent}>
                    {permissions.map(permission => (
                        <PermissionItem
                            key={permission}
                            permission={permission}
                        />
                    ))}
                </PWView>
            </TitledExpandablePanel>

            <PWView style={styles.accountSelectionContainer}>
                <PWText
                    variant='h4'
                    style={styles.accountsTitle}
                >
                    {accountsTitle}
                </PWText>
            </PWView>
        </PWView>
    )

    return (
        <>
            <PWFlatList
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
                data={accounts}
                renderItem={renderAccountRow}
                extraData={{ selected }}
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
                    title={t('common.connect.label')}
                    onPress={() => onApprove(selected)}
                    style={styles.connectButton}
                    isDisabled={!selected.length}
                />
            </PWView>
        </>
    )
}
