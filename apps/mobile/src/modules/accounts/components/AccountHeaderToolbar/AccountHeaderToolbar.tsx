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

import type { StyleProp, ViewStyle } from 'react-native'
import { PWIcon, PWToolbar, PWTouchableOpacity, PWView } from '@components/core'
import { AccountHeaderMenu } from '@components/AccountHeaderMenu'
import { QRScannerView } from '@components/QRScannerView'
import { NotificationsIcon } from '@modules/messages'
import { routeCapabilities } from '@routes/capabilities'
import { AccountSelection } from '../AccountSelection'
import {
    useAccountHeaderToolbar,
    type AccountHeaderToolbarEvents,
} from './useAccountHeaderToolbar'
import { useStyles } from './styles'

export type AccountHeaderToolbarProps = {
    /** Prefix of every button's test id, e.g. `account_screen`. Render it edge to edge. */
    testIDPrefix: string
    /** The host screen's QR and paste-link events. */
    events: AccountHeaderToolbarEvents
    style?: StyleProp<ViewStyle>
}

/**
 * The account header of the Home tab: the selected account, its menu, the QR
 * scanner, paste link and notifications. Discover shows the same header.
 */
export const AccountHeaderToolbar = ({
    testIDPrefix,
    events,
    style,
}: AccountHeaderToolbarProps) => {
    const styles = useStyles()
    const toolbar = useAccountHeaderToolbar({ events })

    return (
        <>
            <PWToolbar
                paddingStyle='none'
                style={[styles.bar, style]}
                left={
                    <AccountSelection
                        showSearch
                        style={styles.accountSelection}
                        showPeraCardActivation
                    />
                }
                right={
                    <PWView style={styles.section}>
                        <AccountHeaderMenu
                            testID={`${testIDPrefix}_dropdown`}
                        />
                        {routeCapabilities.qrScanner && (
                            <PWTouchableOpacity
                                onPress={toolbar.openScanner}
                                testID={`${testIDPrefix}_qr_scanner_button`}
                            >
                                <PWIcon name='camera' />
                            </PWTouchableOpacity>
                        )}
                        {routeCapabilities.deepLinkPaste && (
                            <PWTouchableOpacity
                                onPress={toolbar.openPasteLink}
                                testID={`${testIDPrefix}_paste_link_button`}
                            >
                                <PWIcon name='link' />
                            </PWTouchableOpacity>
                        )}
                        <NotificationsIcon
                            testID={`${testIDPrefix}_notifications`}
                        />
                    </PWView>
                }
            />
            {routeCapabilities.qrScanner && (
                <QRScannerView
                    isVisible={toolbar.isScannerOpen}
                    onSuccess={toolbar.closeScanner}
                    onClose={toolbar.closeScanner}
                    animationType='slide'
                />
            )}
        </>
    )
}
