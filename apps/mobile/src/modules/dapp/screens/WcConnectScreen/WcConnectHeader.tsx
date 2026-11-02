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
// and warns from the transport's origin verdict, not the requesting tab. Fidelity comes from importing its stylesheet
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
import type { ConnectionPeer } from '@perawallet/wallet-extension-connections'
import { useLanguage } from '@hooks/useLanguage'
import type { VerificationTier } from '@perawallet/wallet-core-projects'
import { ProjectVerificationIcon } from '@modules/projects'
import {
    ConnectionPermissionsPanel,
    getPreferredDappIcon,
    type ConnectionPermission,
} from '@modules/walletconnect'
import { useStyles } from '@components/ConnectionApproval/styles'
import type { ChainNetworkLabel } from './useWcConnectScreen'

export type WcConnectHeaderProps = {
    peer: ConnectionPeer
    /** `peer.name` cleaned and clamped for display. */
    peerName: string
    permissions: ConnectionPermission[]
    chainNetwork?: ChainNetworkLabel
    verificationTier?: VerificationTier
    /** Host of the browser-verified requesting tab, for display; `peer.url` is forgeable. */
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
    chainNetwork,
    verificationTier,
    requesterOriginLabel,
    isRequesterOriginDistinct = false,
    peerUrlLabel,
    canOpenPeerUrl,
    onPressUrl,
}: WcConnectHeaderProps): React.JSX.Element => {
    const styles = useStyles()
    const { t } = useLanguage()

    const preferredIcon = getPreferredDappIcon(peer.icons)

    return (
        <PWView style={styles.headerContainer}>
            {/* No network badges: TestnetIndicator already states the active network
                here, and a proposal only arrives once the host's network gate passed it.
                Another chain's network is named as text under the title instead. */}
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
                {!!chainNetwork && (
                    <PWText
                        variant='caption'
                        style={styles.peerUrlText}
                        testID='wc-connect-chain-network'
                    >
                        {t('dapp.approval.chain_network', chainNetwork)}
                    </PWText>
                )}
                {/* A page CAN pair while asserting someone else's url. Then the
                    asserted url is not shown as a link at all: the warning names
                    the real (browser-stamped) origin and the claimed one. */}
                {!!requesterOriginLabel && isRequesterOriginDistinct ? (
                    <PWView
                        style={styles.originWarning}
                        testID='wc-connect-requester-mismatch'
                    >
                        <PWRoundIcon
                            icon='warning'
                            size='sm'
                            variant='error'
                        />
                        <PWText
                            variant='body'
                            style={styles.originWarningText}
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
                            <PWView style={styles.originVerified}>
                                <PWIcon
                                    name='assets/verified'
                                    size='sm'
                                />
                                <PWText
                                    variant='caption'
                                    style={styles.originVerifiedText}
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

            <ConnectionPermissionsPanel permissions={permissions} />

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
