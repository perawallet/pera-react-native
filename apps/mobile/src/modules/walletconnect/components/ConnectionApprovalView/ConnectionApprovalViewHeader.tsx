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
    PWBadge,
    PWButton,
    PWIcon,
    PWImage,
    PWText,
    PWView,
} from '@components/core'
import { useStyles } from '@modules/walletconnect/components/connection-approval/styles'
import { useStyles as usePermissionItemStyles } from '../PermissionItem/styles'
import {
    generateOrderedUniqueId,
    type Network,
} from '@perawallet/wallet-core-shared'
import type { ConnectionPeer } from '@perawallet/wallet-extension-connections'
import { useLanguage } from '@hooks/useLanguage'
import { useWebView } from '@modules/webview'
import {
    resolveDisplayableVerificationTier,
    useProjectByUrlQuery,
} from '@perawallet/wallet-core-projects'
import { TitledExpandablePanel } from '@components/ExpandablePanel/TitledExpandablePanel'
import { ProjectVerificationIcon } from '@modules/projects/components/ProjectVerificationIcon'
import { getPreferredDappIcon } from '../../utils/dapp-icon'

export type ConnectionApprovalViewHeaderProps = {
    peer: ConnectionPeer
    /**
     * Handler-resolved list (v1's 4160 wildcard already expanded), not a wire chain
     * id. `'custom'` is filtered from the badge row: it names a runtime-configurable
     * node slot with no translated label.
     */
    networks: Network[]
    /**
     * Wire method strings (e.g. `algo_signTxn`); unrecognised ones fall back to
     * the raw string since another handler's methods need not match v1's.
     */
    methods: string[]
}

const permissionTitleKey: Record<string, string> = {
    algo_signTxn: 'walletconnect.request.permissions_sign_transaction',
    algo_signData: 'walletconnect.request.permissions_sign_data',
    algo_getAccounts: 'walletconnect.request.permissions_request_accounts',
}

export const ConnectionApprovalViewHeader = ({
    peer,
    networks,
    methods,
}: ConnectionApprovalViewHeaderProps) => {
    const styles = useStyles()
    const permissionItemStyles = usePermissionItemStyles()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()

    // The registry is keyed by the peer-asserted URL, which is spoofable, so it
    // can never mint the `verified` checkmark; `resolveDisplayableVerificationTier`
    // suppresses the positive tier. A `suspicious` hit is still surfaced.
    const { data: project } = useProjectByUrlQuery({
        url: peer.url,
        isEnabled: !!peer.url,
    })

    // Never a spoofed checkmark: only a `suspicious` warning or nothing.
    const verificationTier = resolveDisplayableVerificationTier(
        project,
        undefined,
    )

    const preferredIcon = getPreferredDappIcon(peer.icons)

    const handlePressUrl = () => {
        if (!peer.url) return
        pushWebView({
            id: generateOrderedUniqueId(),
            url: peer.url,
        })
    }

    return (
        <PWView style={styles.headerContainer}>
            <PWView style={styles.networksContainer}>
                {/* `networks` is already the resolved set a v1 wildcard is valid on,
                    so betanet is a real granted network here, not a badge to special-case away. */}
                {networks
                    .filter(network => network !== 'custom')
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
                    >
                        {t('walletconnect.request.title', {
                            name: peer.name,
                        })}
                    </PWText>
                    {!!verificationTier && (
                        <ProjectVerificationIcon
                            tier={verificationTier}
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
