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
import { useStyles } from './styles'
import {
    AlgorandChain,
    AlgorandChainId,
    type AlgorandPermission,
    type WalletConnectSessionRequest,
} from '@perawallet/wallet-core-walletconnect'
import { useLanguage } from '@hooks/useLanguage'
import { useWebView } from '@modules/webview'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import {
    resolveDisplayableVerificationTier,
    useProjectByUrlQuery,
} from '@perawallet/wallet-core-projects'
import { TitledExpandablePanel } from '@components/ExpandablePanel/TitledExpandablePanel'
import { ProjectVerificationIcon } from '@modules/projects/components/ProjectVerificationIcon'
import { PermissionItem } from '../PermissionItem'
import { getPreferredDappIcon } from '../../utils/dapp-icon'

export type ConnectionViewHeaderProps = {
    request: WalletConnectSessionRequest
}

export const ConnectionViewHeader = ({
    request,
}: ConnectionViewHeaderProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()

    // The registry is looked up by the peer-asserted URL. That key is
    // spoofable, so it can never mint the `verified` checkmark: a WalletConnect
    // request has no platform-observed origin, so `resolveDisplayableVerificationTier`
    // suppresses the positive tier here. A `suspicious` hit is still surfaced —
    // fail-loud — so a known-scam URL can't hide (PERA-4715).
    const { data: project } = useProjectByUrlQuery({
        url: request.peerMeta.url,
        isEnabled: !!request.peerMeta.url,
    })

    // WalletConnect never carries a verifiedOrigin, so this only ever resolves
    // to a `suspicious` warning or nothing — never a spoofed checkmark.
    const verificationTier = resolveDisplayableVerificationTier(
        project,
        undefined,
    )

    const preferredIcon = getPreferredDappIcon(request.peerMeta.icons)

    const handlePressUrl = () => {
        if (!request.peerMeta.url) return
        pushWebView({
            id: generateOrderedUniqueId(),
            url: request.peerMeta.url,
        })
    }

    return (
        <PWView style={styles.headerContainer}>
            <PWView style={styles.networksContainer}>
                {request.chainId !== AlgorandChainId.all ? (
                    <PWBadge
                        value={t(
                            `walletconnect.request.networks_${AlgorandChain[request.chainId]}`,
                        )}
                        variant={
                            request.chainId === AlgorandChainId.testnet
                                ? 'testnet'
                                : 'primary'
                        }
                    />
                ) : (
                    <>
                        <PWBadge
                            value={t('walletconnect.request.networks_mainnet')}
                            variant='primary'
                        />
                        <PWBadge
                            value={t('walletconnect.request.networks_testnet')}
                            variant='testnet'
                        />
                    </>
                )}
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
                            name: request.peerMeta.name,
                        })}
                    </PWText>
                    {!!verificationTier && (
                        <ProjectVerificationIcon
                            tier={verificationTier}
                            size='sm'
                        />
                    )}
                </PWView>
                {!!request.peerMeta.url && (
                    <PWButton
                        variant='link'
                        onPress={handlePressUrl}
                        title={request.peerMeta.url}
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
                            count: request.permissions.length,
                        })}
                    </PWText>
                }
            >
                <PWView style={styles.permissionsContent}>
                    {request.permissions.map((permission, index) => (
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
