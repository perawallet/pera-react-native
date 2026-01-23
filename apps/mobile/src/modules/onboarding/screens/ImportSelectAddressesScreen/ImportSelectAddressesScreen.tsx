/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import React from 'react'
import { PWView, PWText, PWToolbar, PWIcon, PWTouchableOpacity } from '@components/core'
import { useStyles } from './styles'
import { useImportSelectAddressesScreen } from './useImportSelectAddressesScreen'
import { useAppNavigation } from '@hooks/useAppNavigation'

export const ImportSelectAddressesScreen = () => {
    const styles = useStyles()
    const { accounts, t } = useImportSelectAddressesScreen()
    const navigation = useAppNavigation()

    return (
        <PWView style={styles.container}>
            <PWToolbar
                left={
                    <PWTouchableOpacity onPress={navigation.goBack}>
                        <PWIcon name="chevron-left" />
                    </PWTouchableOpacity>
                }
            />
            <PWView style={styles.content}>
                <PWText variant="h1">{t('onboarding.import_select_addresses.title')}</PWText>
                {/* List of accounts will be implemented here */}
            </PWView>
        </PWView>
    )
}
