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
import type { AlgorandPermission } from '@perawallet/wallet-core-walletconnect'
import {
    PWBadge,
    PWButton,
    PWIcon,
    PWImage,
    PWText,
    PWView,
} from '@components/core'
import { TitledExpandablePanel } from '@components/ExpandablePanel/TitledExpandablePanel'
import { useLanguage } from '@hooks/useLanguage'
import { PermissionItem } from '../PermissionItem'
import type { ConnectionNetwork } from '../ConnectionDetailsView'
import { useStyles } from './styles'

export type DappConnectionHeaderProps = {
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
}

/**
 * The shared dApp identity block at the top of every connection sheet: network
 * badges, the dApp icon (with fallback), title + URL/host subtitle, and the
 * Advanced Permissions panel. Both the WalletConnect approval sheet and the
 * Liquid Auth confirm step compose it; account selection is the caller's
 * responsibility.
 */
export const DappConnectionHeader = ({
    networks,
    iconUri,
    fallbackIconName,
    title,
    subtitle,
    onSubtitlePress,
    permissions,
}: DappConnectionHeaderProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const [iconFailed, setIconFailed] = useState(false)

    return (
        <PWView style={styles.container}>
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
        </PWView>
    )
}
