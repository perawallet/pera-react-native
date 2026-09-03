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

// Web/extension twin of @modules/walletconnect's ConnectionViewHeader.
//
// A twin rather than a reuse, by owner decision (2026-07-30): phase one keeps
// the mobile component untouched, and a later phase factors the two into one
// shared consent view. Two things make the mobile one unusable here as-is:
//
//   - It navigates the dApp URL with `useWebView().pushWebView`, which on the
//     approval page pushes into a store nothing renders — a visibly dead
//     button. Here the link opens a real browser tab.
//   - Its `request` comes from the WC session-request store, which no
//     extension surface may read (offscreen owns connectors).
//
// VISUAL FIDELITY is held by importing ConnectionView's own stylesheet rather
// than copying values out of it, and by keeping this element tree and its i18n
// keys aligned with that component. Nothing here re-declares a spacing, colour
// or radius. See __tests__/visualFidelity.spec.ts, which fails if the two
// element trees drift apart.
import React from 'react'
import { Linking } from 'react-native'
import { PWButton, PWIcon, PWImage, PWText, PWView } from '@components/core'
import type {
    AlgorandPermission,
    WalletConnectSessionRequest,
} from '@perawallet/wallet-core-walletconnect'
import { useLanguage } from '@hooks/useLanguage'
import { useProjectByUrlQuery } from '@perawallet/wallet-core-projects'
import { TitledExpandablePanel } from '@components/ExpandablePanel/TitledExpandablePanel'
import { ProjectVerificationIcon } from '@modules/projects/components/ProjectVerificationIcon'
import { PermissionItem } from '@modules/walletconnect/components/PermissionItem'
// Shared verbatim with ConnectionView/ConnectionViewHeader — the single source
// of these visuals.
import { useStyles } from '@modules/walletconnect/components/ConnectionView/styles'
import { useStyles as useRequesterStyles } from './styles'

export type WcConnectHeaderProps = {
    request: WalletConnectSessionRequest
    /**
     * Browser-verified origin of the tab that asked to pair. Rendered with an
     * explicit "verified" marker to distinguish it from `peerMeta.url` above,
     * which the dApp asserts and can forge.
     */
    requesterOrigin?: string
    /**
     * Whether `requesterOrigin` differs from the origin of the peer-asserted
     * `peerMeta.url`. When it does, the badge alone can't stand in for it —
     * see the comment at the render site.
     */
    isRequesterOriginDistinct?: boolean
}

export const WcConnectHeader = ({
    request,
    requesterOrigin,
    isRequesterOriginDistinct = false,
}: WcConnectHeaderProps): React.JSX.Element => {
    const styles = useStyles()
    const requesterStyles = useRequesterStyles()
    const { t } = useLanguage()

    // Same registry lookup mobile's header does: the peer-asserted URL resolves
    // to a Pera-curated verification tier, so a spoofed name/icon still can't
    // claim the verified checkmark.
    const { data: project } = useProjectByUrlQuery({
        url: request.peerMeta.url,
        isEnabled: !!request.peerMeta.url,
    })

    const preferredIcon =
        request.peerMeta.icons?.find(
            icon =>
                icon.endsWith('.png') ||
                icon.endsWith('.jpg') ||
                icon.endsWith('.jpeg'),
        ) ?? request.peerMeta.icons?.at(0)

    const handlePressUrl = (): void => {
        if (!request.peerMeta.url) return
        // A new browser tab, not a webview: mobile's pushWebView has nothing
        // rendering it in the approval document.
        void Linking.openURL(request.peerMeta.url)
    }

    return (
        <PWView style={styles.headerContainer}>
            {/*
                Mobile's network badges are deliberately NOT rendered here.
                The extension already shows the active network globally —
                TestnetIndicator, absolutely positioned at the top of every
                surface from AppShell.web.tsx — and it lands in exactly this
                spot, so a badge here stacks on top of it and says the same
                thing twice.

                Redundant, not merely crowded: a request only reaches this
                screen after passing the host's network gate
                (`isChainIdAcceptable` in bindHeadlessHandlers), so the
                requested chain is always either the wallet's own active
                network — which the global indicator states — or the 4160
                wildcard. The wildcard is the one case that loses information
                (mobile shows both badges to mean "any Algorand chain"); it is
                accepted here rather than reintroducing the collision, since
                what the user is granting is still their active network.
            */}
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
                            name: request.peerMeta.name,
                        })}
                    </PWText>
                    {!!project?.verificationTier && (
                        <ProjectVerificationIcon
                            tier={project.verificationTier}
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
                {!!requesterOrigin && (
                    <PWView style={requesterStyles.verifiedRow}>
                        {/*
                            Normally just the badge, centred: the verified
                            origin equals the url rendered directly above, and
                            spelling it out again read as the same string twice.
                            The badge is what qualifies that url as a verified
                            tab.

                            It can only qualify a url it actually matches,
                            though — the url above is the dApp's own
                            `peerMeta` claim and the requester origin is
                            browser-stamped, so a page CAN pair while
                            asserting someone else's url. In that case the
                            badge alone would appear to vouch for the forged
                            one, so the real origin is named instead. This is
                            the divergence the whole verified-requester
                            feature exists to expose.
                        */}
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
                                    // Carries the origin the visible text no
                                    // longer shows, so assistive tech still
                                    // gets it.
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
