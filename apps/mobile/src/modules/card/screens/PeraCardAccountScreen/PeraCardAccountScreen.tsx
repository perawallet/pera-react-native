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

import { PWIcon, PWToolbar, PWView } from '@components/core'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AccountSelection } from '@modules/accounts/components/AccountSelection'
import { PeraCardTabNavigator } from '../../components/PeraCardTabNavigator'
import { usePeraCardAccountScreen } from './usePeraCardAccountScreen'
import { useStyles } from './styles'

export const PeraCardAccountScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { cardDisplay, onSelectAccount, onMore, onScan, onInbox } =
        usePeraCardAccountScreen()

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
                        card={cardDisplay}
                        showSearch
                        showPeraCardActivation
                        onSelected={onSelectAccount}
                        style={styles.accountSelectionToolbar}
                    />
                }
                right={
                    <PWView style={styles.iconBarSection}>
                        <PWIcon
                            name='ellipsis'
                            onPress={onMore}
                            testID='pera_card_account_more_button'
                        />
                        <PWIcon
                            name='camera'
                            onPress={onScan}
                            testID='pera_card_account_scan_button'
                        />
                        <PWIcon
                            name='inbox'
                            onPress={onInbox}
                            testID='pera_card_account_inbox_button'
                        />
                    </PWView>
                }
            />
            <PWView style={styles.tabNavigator}>
                <PeraCardTabNavigator />
            </PWView>
        </PWView>
    )
}
