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

// Not a reuse of ConnectionApprovalViewHeader: that one navigates the dApp url
// through a webview nothing renders here. Fidelity comes from importing its
// stylesheet (see __tests__/visualFidelity.spec.ts).
import React from 'react'
import { Linking } from 'react-native'
import { PWButton, PWIcon, PWImage, PWText, PWView } from '@components/core'
import type { AlgorandPermission } from '@perawallet/wallet-core-walletconnect'
import type { ConnectionPeer } from '@perawallet/wallet-extension-connections'
import { useLanguage } from '@hooks/useLanguage'
import { useProjectByUrlQuery } from '@perawallet/wallet-core-projects'
import { TitledExpandablePanel } from '@components/ExpandablePanel/TitledExpandablePanel'
import { ProjectVerificationIcon } from '@modules/projects/components/ProjectVerificationIcon'
import { PermissionItem } from '@modules/walletconnect/components/PermissionItem'
import { useStyles } from '@modules/walletconnect/components/connection-approval/styles'
import { useStyles as useRequesterStyles } from './styles'

export type WcConnectHeaderProps = {
    peer: ConnectionPeer
    permissions: string[]
    /** Browser-verified origin of the requesting tab; `peer.url` is forgeable. */
    requesterOrigin?: string
    /** When true the badge alone cannot vouch for `peer.url`, so the origin is named. */
    isRequesterOriginDistinct?: boolean
}

export const WcConnectHeader = ({
    peer,
    permissions,
    requesterOrigin,
    isRequesterOriginDistinct = false,
}: WcConnectHeaderProps): React.JSX.Element => {
    const styles = useStyles()
    const requesterStyles = useRequesterStyles()
    const { t } = useLanguage()

    // The peer-asserted url resolves to a Pera-curated verification tier, so
    // a spoofed name/icon still can't claim the checkmark.
    const { data: project } = useProjectByUrlQuery({
        url: peer.url ?? '',
        isEnabled: !!peer.url,
    })

    const preferredIcon =
        peer.icons?.find(
            icon =>
                icon.endsWith('.png') ||
                icon.endsWith('.jpg') ||
                icon.endsWith('.jpeg'),
        ) ?? peer.icons?.at(0)

    const handlePressUrl = (): void => {
        if (!peer.url) return
        // A new browser tab: nothing renders mobile's webview here.
        void Linking.openURL(peer.url)
    }

    return (
        <PWView style={styles.headerContainer}>
            {/* No network badges: TestnetIndicator already states the active network
                here, and a proposal only arrives once the host's network gate passed it. */}
            {preferredIcon ? (
                <PWImage
                    source={{ uri: preferredIcon }}
                    style={styles.icon}
                />
            ) : (
                <PWView style={styles.iconContainer}>
                    <PWIcon
                        name='wallet-connect'
                        variant='secondary'
                        size='xl'
                    />
                </PWView>
            )}
            <PWView style={styles.titleContainer}>
                <PWView style={styles.nameRow}>
                    <PWText
                        variant='h3'
                        style={styles.title}
                        testID='wc-connect-peer-name'
                    >
                        {t('walletconnect.request.title', {
                            name: peer.name,
                        })}
                    </PWText>
                    {!!project?.verificationTier && (
                        <ProjectVerificationIcon
                            tier={project.verificationTier}
                            size='sm'
                        />
                    )}
                </PWView>
                {!!peer.url && (
                    <PWButton
                        variant='link'
                        onPress={handlePressUrl}
                        title={peer.url}
                    />
                )}
                {!!requesterOrigin && (
                    <PWView style={requesterStyles.verifiedRow}>
                        {/* A page CAN pair while asserting someone else's url; the badge
                            alone would then vouch for the forged one, so the real
                            (browser-stamped) origin is named. */}
                        {isRequesterOriginDistinct && (
                            <PWText
                                variant='caption'
                                style={requesterStyles.requesterOrigin}
                                testID='wc-connect-requester-origin'
                            >
                                {t('dapp.enable.request_origin', {
                                    origin: requesterOrigin,
                                })}
                            </PWText>
                        )}
                        <PWView style={requesterStyles.verifiedBadge}>
                            <PWIcon
                                name='assets/verified'
                                size='sm'
                            />
                            <PWText
                                variant='caption'
                                style={requesterStyles.verifiedBadgeText}
                                accessibilityLabel={t(
                                    // The visible text drops the origin; assistive tech keeps it.
                                    'dapp.enable.requester_verified_a11y_origin',
                                    { origin: requesterOrigin },
                                )}
                                testID='wc-connect-requester-verified-badge'
                            >
                                {t('dapp.enable.requester_verified_label')}
                            </PWText>
                        </PWView>
                    </PWView>
                )}
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
                    {permissions.map((permission, index) => (
                        <PermissionItem
                            key={index}
                            permission={permission as AlgorandPermission}
                        />
                    ))}
                </PWView>
            </TitledExpandablePanel>

            <PWView style={styles.accountSelectionContainer}>
                <PWText
                    variant='h4'
                    style={styles.permissionsTitle}
                >
                    {t('walletconnect.request.accounts_title')}
                </PWText>
            </PWView>
        </PWView>
    )
}
