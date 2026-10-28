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
    i18nKey,
    type I18nKey,
    type NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import {
    PWBadge,
    PWButton,
    PWIcon,
    PWImage,
    PWRoundIcon,
    PWText,
    PWView,
} from '@components/core'
import { useStyles } from '@components/ConnectionApproval/styles'
import { useStyles as usePermissionItemStyles } from '../PermissionItem/styles'
import type { ConnectionPeer } from '@perawallet/wallet-extension-connections'
import { useLanguage } from '@hooks/useLanguage'
import {
    resolveDisplayableVerificationTier,
    useProjectByUrlQuery,
} from '@perawallet/wallet-core-projects'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { TitledExpandablePanel } from '@components/ExpandablePanel/TitledExpandablePanel'
import { ProjectVerificationIcon } from '@modules/projects'
import { getPreferredDappIcon } from '../../utils/dapp-icon'
import {
    toOriginWarningMessage,
    type ConnectionOriginWarning,
} from './useConnectionApprovalView'

export type ConnectionApprovalViewHeaderProps = {
    peer: ConnectionPeer
    /** `peer.name` cleaned and clamped for display. */
    peerName: string
    /**
     * Handler-resolved list (v1's 4160 wildcard already expanded), not a wire
     * chain id. Only ids with a translated label get a badge: two chains can
     * both report `mainnet`, `sepolia` has no label, and `custom` names a
     * runtime-configurable node slot.
     */
    networks: NetworkId[]
    /**
     * Wire method strings (e.g. `algo_signTxn`); unrecognised ones fall back to
     * the raw string since another handler's methods need not match v1's.
     */
    methods: string[]
    peerUrlLabel?: string
    canOpenPeerUrl: boolean
    onPressUrl: () => void
    originWarning?: ConnectionOriginWarning
    /** Host of the transport-attested origin; `peerUrlLabel` is forgeable. */
    verifiedOriginLabel?: string
    /** A phishing-list or look-alike hit on any of the proposal's origins. */
    hasSiteWarning?: boolean
}

const LABELED_NETWORKS: readonly NetworkId[] = ['mainnet', 'testnet', 'betanet']

const permissionTitleKey: Record<string, I18nKey> = {
    algo_signTxn: i18nKey('walletconnect.request.permissions_sign_transaction'),
    algo_signData: i18nKey('walletconnect.request.permissions_sign_data'),
    algo_getAccounts: i18nKey(
        'walletconnect.request.permissions_request_accounts',
    ),
}

export const ConnectionApprovalViewHeader = ({
    peer,
    peerName,
    networks,
    methods,
    peerUrlLabel,
    canOpenPeerUrl,
    onPressUrl,
    originWarning,
    verifiedOriginLabel,
    hasSiteWarning = false,
}: ConnectionApprovalViewHeaderProps) => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const styles = useStyles()
    const permissionItemStyles = usePermissionItemStyles()
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
                {/* `networks` is already the resolved set a v1 wildcard is valid on,
                    so betanet is a real granted network here, not a badge to special-case away. */}
                {[...new Set(networks)]
                    .filter(network => LABELED_NETWORKS.includes(network))
                    .map(network => (
                        <PWBadge
                            key={network}
                            value={t(
                                `walletconnect.request.networks_${network}`,
                            )}
                            variant={
                                network === 'testnet' ? 'testnet' : 'primary'
                            }
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

            <TitledExpandablePanel
                containerStyle={styles.permissionsContainer}
                title={
                    <PWText
                        variant='h4'
                        style={styles.panelTitle}
                    >
                        {t('walletconnect.request.permissions_title', {
                            count: methods.length,
                        })}
                    </PWText>
                }
            >
                <PWView style={styles.permissionsContent}>
                    {methods.map((method, index) => (
                        <PWView
                            key={index}
                            style={permissionItemStyles.permissionItemContainer}
                        >
                            <PWIcon
                                name='check'
                                variant='positive'
                            />
                            <PWText>
                                {permissionTitleKey[method]
                                    ? t(permissionTitleKey[method])
                                    : method}
                            </PWText>
                        </PWView>
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
