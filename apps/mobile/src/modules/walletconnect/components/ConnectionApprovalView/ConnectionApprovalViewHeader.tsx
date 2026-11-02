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

import {
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import {
    PWButton,
    PWIcon,
    PWImage,
    PWRoundIcon,
    PWText,
    PWView,
} from '@components/core'
import { useStyles } from '@components/ConnectionApproval/styles'
import type { ConnectionPeer } from '@perawallet/wallet-extension-connections'
import { useLanguage } from '@hooks/useLanguage'
import {
    resolveDisplayableVerificationTier,
    useProjectByUrlQuery,
} from '@perawallet/wallet-core-projects'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { ProjectVerificationIcon } from '@modules/projects'
import type { ConnectionPermission } from '../../utils/connectionPermissions'
import { getPreferredDappIcon } from '../../utils/dapp-icon'
import { ConnectionPermissionsPanel } from '../ConnectionPermissionsPanel'
import { RequestedNetworkChip } from './RequestedNetworkChip'
import {
    toOriginWarningMessage,
    type ConnectionOriginWarning,
    type RequestedNetwork,
} from './useConnectionApprovalView'

export type ConnectionApprovalViewHeaderProps = {
    peer: ConnectionPeer
    /** The headline, already naming the networks the dApp asked for. */
    title: string
    requestedNetworks: RequestedNetwork[]
    onAddNetwork: (chainId: ChainId) => void
    permissions: ConnectionPermission[]
    /** WalletConnect Verify attested the origin and site safety found nothing against it. */
    isOriginVerified: boolean
    peerUrlLabel?: string
    canOpenPeerUrl: boolean
    onPressUrl: () => void
    originWarning?: ConnectionOriginWarning
    /** Host of the transport-attested origin; `peerUrlLabel` is forgeable. */
    verifiedOriginLabel?: string
    /** A phishing-list or look-alike hit on any of the proposal's origins. */
    hasSiteWarning?: boolean
}

export const ConnectionApprovalViewHeader = ({
    peer,
    title,
    requestedNetworks,
    onAddNetwork,
    permissions,
    isOriginVerified,
    peerUrlLabel,
    canOpenPeerUrl,
    onPressUrl,
    originWarning,
    verifiedOriginLabel,
    hasSiteWarning = false,
}: ConnectionApprovalViewHeaderProps) => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const styles = useStyles()
    const { t } = useLanguage()

    // The registry is keyed by the peer-asserted URL, which is spoofable, so it
    // can never mint the `verified` checkmark; `resolveDisplayableVerificationTier`
    // suppresses the positive tier. A `suspicious` hit is still surfaced.
    const { data: project } = useProjectByUrlQuery({
        scope,
        url: peer.url,
        isEnabled: !!peer.url,
    })

    // Never a spoofed checkmark: only a `suspicious` warning or nothing.
    const verificationTier = resolveDisplayableVerificationTier(
        project,
        undefined,
        hasSiteWarning,
    )

    const preferredIcon = getPreferredDappIcon(peer.icons)

    const originWarningMessage =
        originWarning === 'scam' || originWarning === 'mismatch'
            ? toOriginWarningMessage(
                  originWarning,
                  verifiedOriginLabel,
                  peerUrlLabel,
              )
            : undefined

    return (
        <PWView style={styles.headerContainer}>
            <PWView style={styles.networksContainer}>
                {requestedNetworks.map(network => (
                    <RequestedNetworkChip
                        key={network.chainId}
                        network={network}
                        onAdd={onAddNetwork}
                    />
                ))}
            </PWView>
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
                    >
                        {title}
                    </PWText>
                    {!!verificationTier && (
                        <ProjectVerificationIcon
                            tier={verificationTier}
                            size='sm'
                        />
                    )}
                </PWView>
                {/* A peer whose real origin is not the url it claims must not
                    get that url as a link: the warning names both instead. */}
                {originWarningMessage ? (
                    <PWView
                        style={styles.originWarning}
                        testID='wc_origin_warning'
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
                            {t(
                                originWarningMessage.key,
                                originWarningMessage.params,
                            )}
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
                                >
                                    {peerUrlLabel}
                                </PWText>
                            ))}
                        {isOriginVerified && (
                            <PWView
                                style={styles.originVerified}
                                testID='wc_origin_verified'
                            >
                                <PWIcon
                                    name='assets/verified'
                                    size='sm'
                                />
                                <PWText
                                    variant='caption'
                                    style={styles.originVerifiedText}
                                >
                                    {t('walletconnect.request.origin_verified')}
                                </PWText>
                            </PWView>
                        )}
                        {originWarning === 'unverified' && (
                            <PWText
                                variant='caption'
                                style={styles.originUnverifiedText}
                                testID='wc_origin_unverified'
                            >
                                {t('walletconnect.request.origin_unverified')}
                            </PWText>
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
