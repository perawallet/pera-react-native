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

import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PWIcon, PWToolbar, PWTouchableOpacity, PWView } from '@components/core'
import { AccountHeaderMenu } from '@components/AccountHeaderMenu'
import { QRScannerView } from '@components/QRScannerView'
import { AccountSelection } from '@modules/accounts'
import { NotificationsIcon } from '@modules/messages'
import { routeCapabilities } from '@routes/capabilities'
import { PeraCardTabNavigator } from '../../components/PeraCardTabNavigator'
import { usePeraCardAccountScreen } from './usePeraCardAccountScreen'
import { useStyles } from './styles'

export const PeraCardAccountScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const {
        cardDisplay,
        accountPicker,
        isScannerVisible,
        onScan,
        onScannerClose,
    } = usePeraCardAccountScreen()

    return (
        <PWView
            style={styles.container}
            testID='pera_card_account_screen'
        >
            <PWToolbar
                paddingStyle='none'
                style={styles.iconBar}
                left={
                    <AccountSelection
                        {...accountPicker}
                        card={cardDisplay}
                        style={styles.accountSelectionToolbar}
                    />
                }
                right={
                    <PWView style={styles.iconBarSection}>
                        <AccountHeaderMenu
                            testID='pera_card_account_more_button'
                            showChartToggle={false}
                        />
                        {routeCapabilities.qrScanner && (
                            <PWTouchableOpacity
                                onPress={onScan}
                                testID='pera_card_account_scan_button'
                            >
                                <PWIcon name='camera' />
                            </PWTouchableOpacity>
                        )}
                        <NotificationsIcon testID='pera_card_account_inbox_button' />
                    </PWView>
                }
            />
            <PWView style={styles.tabNavigator}>
                <PeraCardTabNavigator />
            </PWView>
            {routeCapabilities.qrScanner && (
                <QRScannerView
                    isVisible={isScannerVisible}
                    onSuccess={onScannerClose}
                    onClose={onScannerClose}
                    animationType='slide'
                />
            )}
        </PWView>
    )
}
