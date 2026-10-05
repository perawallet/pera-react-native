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

// Not a reuse of ConnectionApprovalViewHeader: that one carries network badges
// and no requester-origin row. Fidelity comes from importing its stylesheet
// (see __tests__/visualFidelity.spec.ts).
import React from 'react'
import {
    PWButton,
    PWIcon,
    PWImage,
    PWRoundIcon,
    PWText,
    PWView,
} from '@components/core'
import type { AlgorandPermission } from '@perawallet/wallet-core-walletconnect'
import type { ConnectionPeer } from '@perawallet/wallet-extension-connections'
import { useLanguage } from '@hooks/useLanguage'
import {
    resolveDisplayableVerificationTier,
    useProjectByUrlQuery,
} from '@perawallet/wallet-core-projects'
import { TitledExpandablePanel } from '@components/ExpandablePanel/TitledExpandablePanel'
import { ProjectVerificationIcon } from '@modules/projects'
import { getPreferredDappIcon, PermissionItem } from '@modules/walletconnect'
import { useStyles } from '@components/ConnectionApproval/styles'
import { useStyles as useRequesterStyles } from './styles'

export type WcConnectHeaderProps = {
    peer: ConnectionPeer
    /** `peer.name` cleaned and clamped for display. */
    peerName: string
    permissions: string[]
    /** Browser-verified origin of the requesting tab; `peer.url` is forgeable. */
    requesterOrigin?: string
    /** `requesterOrigin` as its host, for display. */
    requesterOriginLabel?: string
    /** When true `peer.url` is not the requesting tab, so the header warns instead. */
    isRequesterOriginDistinct?: boolean
    peerUrlLabel?: string
    canOpenPeerUrl: boolean
    onPressUrl: () => void
}

export const WcConnectHeader = ({
    peer,
    peerName,
    permissions,
    requesterOrigin,
    requesterOriginLabel,
    isRequesterOriginDistinct = false,
    peerUrlLabel,
    canOpenPeerUrl,
    onPressUrl,
}: WcConnectHeaderProps): React.JSX.Element => {
    const styles = useStyles()
    const requesterStyles = useRequesterStyles()
    const { t } = useLanguage()

    const { data: project } = useProjectByUrlQuery({
        url: peer.url ?? '',
        isEnabled: !!peer.url,
    })

    // The registry is keyed by the peer-asserted url, so a positive tier only
    // shows when the browser-verified tab is that same site. A page asserting
    // someone else's url never inherits their checkmark.
    const verificationTier = resolveDisplayableVerificationTier(
        project,
        isRequesterOriginDistinct ? undefined : requesterOrigin,
    )

    const preferredIcon = getPreferredDappIcon(peer.icons)

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
                        numberOfLines={3}
                        testID='wc-connect-peer-name'
                    >
                        {t('walletconnect.request.title', {
                            name: peerName,
                        })}
                    </PWText>
                    {!!verificationTier && (
                        <ProjectVerificationIcon
                            tier={verificationTier}
                            size='sm'
                        />
                    )}
                </PWView>
                {/* A page CAN pair while asserting someone else's url. Then the
                    asserted url is not shown as a link at all: the warning names
                    the real (browser-stamped) origin and the claimed one. */}
                {!!requesterOriginLabel && isRequesterOriginDistinct ? (
                    <PWView
                        style={requesterStyles.mismatchWarning}
                        testID='wc-connect-requester-mismatch'
                    >
                        <PWRoundIcon
                            icon='warning'
                            size='sm'
                            variant='error'
                        />
                        <PWText
                            variant='body'
                            style={requesterStyles.mismatchWarningText}
                        >
                            {peerUrlLabel
                                ? t('dapp.approval.requester_mismatch', {
                                      origin: requesterOriginLabel,
                                      claimed: peerUrlLabel,
                                  })
                                : t('dapp.approval.request_origin', {
                                      origin: requesterOriginLabel,
                                  })}
                        </PWText>
                    </PWView>
                ) : (
                    <>
                        {!!peerUrlLabel &&
                            (canOpenPeerUrl ? (
                                <PWButton
                                    variant='link'
                                    onPress={onPressUrl}
                                    title={peerUrlLabel}
                                />
                            ) : (
                                <PWText
                                    variant='caption'
                                    style={styles.peerUrlText}
                                    numberOfLines={1}
                                    testID='wc-connect-peer-url-text'
                                >
                                    {peerUrlLabel}
                                </PWText>
                            ))}
                        {!!requesterOriginLabel && (
                            <PWView style={requesterStyles.verifiedBadge}>
                                <PWIcon
                                    name='assets/verified'
                                    size='sm'
                                />
                                <PWText
                                    variant='caption'
                                    style={requesterStyles.verifiedBadgeText}
                                    numberOfLines={1}
                                    accessibilityLabel={t(
                                        'dapp.approval.requester_verified_a11y_origin',
                                        { origin: requesterOriginLabel },
                                    )}
                                    testID='wc-connect-requester-verified-badge'
                                >
                                    {t(
                                        'dapp.approval.requester_verified_label',
                                        {
                                            origin: requesterOriginLabel,
                                        },
                                    )}
                                </PWText>
                            </PWView>
                        )}
                    </>
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
