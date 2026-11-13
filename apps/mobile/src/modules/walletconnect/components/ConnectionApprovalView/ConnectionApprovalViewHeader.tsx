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
import { type ChainId } from '@perawallet/wallet-core-chain-contract'
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
import { ALGORAND_CHAIN_ID } from '@modules/algorand/chain-id'
import { ProjectVerificationIcon } from '@modules/projects'
import type { ConnectionPermission } from '../../utils/connectionPermissions'
import { getPreferredDappIcon } from '../../utils/dapp-icon'
import { ConnectionPermissionsPanel } from '../ConnectionPermissionsPanel'
import { RequestedNetworksPanel } from './RequestedNetworksPanel'
import {
    toOriginWarningMessage,
    type ConnectionOriginWarning,
    type RequestedNetwork,
} from './useConnectionApprovalView'

export type ConnectionApprovalViewHeaderProps = {
    peer: ConnectionPeer
    /** Names the dApp alone; the networks show in the row under it. */
    title: string
    /** Cleaned dApp name; the networks panel's optional note names it. */
    peerName: string
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
    /** The single EVM account row, shown above the account list. */
    evmAccountRow?: ReactNode
    /** False when every requested chain is an EVM chain, so no checkbox list follows. */
    hasAccountList: boolean
}

export const ConnectionApprovalViewHeader = ({
    peer,
    title,
    peerName,
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
    evmAccountRow,
    hasAccountList,
}: ConnectionApprovalViewHeaderProps) => {
    const scope = useSelectedScope(ALGORAND_CHAIN_ID)
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
                        size='lg'
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

            {requestedNetworks.length > 0 && (
                <RequestedNetworksPanel
                    requestedNetworks={requestedNetworks}
                    peerName={peerName}
                    onAddNetwork={onAddNetwork}
                />
            )}

            <ConnectionPermissionsPanel permissions={permissions} />

            {evmAccountRow}

            {hasAccountList && (
                <PWView style={styles.accountSelectionContainer}>
                    <PWText
                        variant='h4'
                        style={styles.permissionsTitle}
                    >
                        {t('walletconnect.request.accounts_title')}
                    </PWText>
                </PWView>
            )}
        </PWView>
    )
}
