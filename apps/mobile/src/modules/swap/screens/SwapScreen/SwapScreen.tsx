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

import { useLanguage } from '@hooks/useLanguage'
import { PWIcon, PWText, PWToolbar, PWView } from '@components/core'
import {
    AccountSelection,
    AccountDrawerPager,
    useAccountDrawerPickerKind,
} from '@modules/accounts'
import { SwapForm } from '@modules/swap/components'
import { useStyles } from './styles'
import { useSwapScreen } from './useSwapScreen'

export const SwapScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { scope, initialPayAmount, accountPicker, handleInfoPress } =
        useSwapScreen()

    // The drawer resolves the same 'swap' picker as the bottom-sheet fallback.
    useAccountDrawerPickerKind('swap')

    return (
        // One page, so nothing to page between — the pager is here purely
        // because its pan is what opens the shared drawer, from anywhere on the
        // screen rather than from a strip at the edge.
        <AccountDrawerPager>
            <PWView
                key='swap'
                style={styles.screen}
            >
                <PWToolbar
                    paddingStyle='none'
                    left={<AccountSelection {...accountPicker} />}
                    right={
                        <PWIcon
                            name='info'
                            onPress={handleInfoPress}
                            testID='swap_info_button'
                            style={styles.infoIcon}
                        />
                    }
                    style={styles.toolbar}
                />

                <PWView style={styles.titleSection}>
                    <PWText
                        variant='h1'
                        truncate
                    >
                        {t('tabbar.swap')}
                    </PWText>
                </PWView>

                {scope && (
                    <PWView style={styles.formWrapper}>
                        <SwapForm
                            scope={scope}
                            initialPayAmount={initialPayAmount}
                        />
                    </PWView>
                )}
            </PWView>
        </AccountDrawerPager>
    )
}
