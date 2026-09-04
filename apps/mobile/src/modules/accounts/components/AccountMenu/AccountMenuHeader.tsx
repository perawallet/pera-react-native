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
import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { PortfolioView } from '../PortfolioView'
import { useStyles } from './styles'

export type AccountMenuHeaderProps = {
    headerContent?: ReactNode
    hideDefaultHeader?: boolean
    onOpenSort: () => void
    onAddAccount: () => void
}

// The full account-list header: portfolio (or a caller-supplied header) plus
// the title row with sort/add actions. Rendered as the list header so the
// whole thing scrolls away with the accounts.
export const AccountMenuHeader = ({
    headerContent,
    hideDefaultHeader = false,
    onOpenSort,
    onAddAccount,
}: AccountMenuHeaderProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView>
            {headerContent ?? (
                <PortfolioView style={styles.portfolioContainer} />
            )}

            {!hideDefaultHeader && (
                <PWView
                    style={styles.titleBar}
                    accessible={false}
                >
                    <PWView style={styles.titleBarTitleContainer}>
                        <PWText
                            variant='h3'
                            style={styles.activeTitle}
                            truncate
                        >
                            {t('account_menu.title')}
                        </PWText>
                    </PWView>
                    <PWView
                        style={styles.titleBarButtonContainer}
                        accessible={false}
                    >
                        <PWButton
                            variant='linkPositive'
                            icon='list-arrow-down'
                            title={t('account_menu.sort')}
                            paddingStyle='dense'
                            onPress={onOpenSort}
                        />
                        <PWButton
                            testID='account_menu_add_account_button'
                            accessibilityLabel='account_menu_add_account_button'
                            variant='helper'
                            icon='plus'
                            paddingStyle='dense'
                            onPress={onAddAccount}
                        />
                    </PWView>
                </PWView>
            )}
        </PWView>
    )
}
