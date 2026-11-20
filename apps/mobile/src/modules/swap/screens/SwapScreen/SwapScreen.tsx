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
import { SwapForm } from '@modules/swap/components'
import { useStyles } from './styles'
import { useSwapScreen } from './useSwapScreen'

export const SwapScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { scope, initialPayAmount, handleInfoPress } = useSwapScreen()

    return (
        <PWView style={styles.screen}>
            <PWToolbar
                paddingStyle='none'
                left={
                    <PWText
                        variant='h1'
                        truncate
                    >
                        {t('tabbar.swap')}
                    </PWText>
                }
                right={
                    <PWIcon
                        name='info'
                        onPress={handleInfoPress}
                        testID='swap_info_button'
                    />
                }
                style={styles.toolbar}
            />

            {scope && (
                <PWView style={styles.formWrapper}>
                    <SwapForm
                        key={scope.chainId}
                        scope={scope}
                        initialPayAmount={initialPayAmount}
                    />
                </PWView>
            )}
        </PWView>
    )
}
