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

import { useLayoutEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import {
    PWView,
    PWText,
    PWButton,
    PWIcon,
    PWTouchableOpacity,
} from '@components/core'

import { LedgerHowItWorksBottomSheet } from '../../components/LedgerHowItWorksBottomSheet'
import { useStyles } from './styles'
import { useLedgerPairScreen } from './useLedgerPairScreen'

export const LedgerPairScreen = () => {
    const styles = useStyles()
    const navigation = useNavigation()
    const {
        isHowDoesItWorkVisible,
        handlePair,
        handleOpenHowDoesItWork,
        handleCloseHowDoesItWork,
        handleOpenSupport,
        t,
    } = useLedgerPairScreen()

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <PWTouchableOpacity
                    onPress={handleOpenSupport}
                    testID='ledger_pair_info_button'
                >
                    <PWIcon name='info' />
                </PWTouchableOpacity>
            ),
        })
    }, [navigation, handleOpenSupport])

    return (
        <PWView style={styles.container}>
            <PWView style={styles.content}>
                <PWView style={styles.iconContainer}>
                    <PWIcon
                        name='ledger'
                        size='xxl'
                        variant='positive'
                    />
                </PWView>

                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {t('ledger.pair.title')}
                </PWText>

                <PWText
                    variant='h4'
                    style={styles.description}
                >
                    {t('ledger.pair.description')}
                </PWText>
            </PWView>

            <SafeAreaView
                edges={['bottom']}
                style={styles.footer}
            >
                <PWButton
                    testID='ledger_pair_primary_button'
                    title={t('ledger.pair.cta')}
                    onPress={handlePair}
                    variant='primary'
                />
                <PWButton
                    testID='ledger_pair_how_does_it_work_button'
                    title={t('ledger.pair.how_does_it_work')}
                    onPress={handleOpenHowDoesItWork}
                    variant='secondary'
                />
            </SafeAreaView>

            <LedgerHowItWorksBottomSheet
                isVisible={isHowDoesItWorkVisible}
                onDismiss={handleCloseHowDoesItWork}
            />
        </PWView>
    )
}
