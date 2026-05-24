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

import {
    PWButton,
    PWIcon,
    PWScreen,
    PWTouchableOpacity,
} from '@components/core'
import { ScreenHeader } from '@components/ScreenHeader'
import { useNavigationHeader } from '@hooks/useNavigationHeader'

import { useStyles } from './styles'
import { useLedgerPairScreen } from './useLedgerPairScreen'

export const LedgerPairScreen = () => {
    const styles = useStyles()
    const { handlePair, handleOpenHowDoesItWork, handleOpenSupport, t } =
        useLedgerPairScreen()

    useNavigationHeader({
        right: (
            <PWTouchableOpacity
                onPress={handleOpenSupport}
                testID='ledger_pair_info_button'
            >
                <PWIcon name='info' />
            </PWTouchableOpacity>
        ),
    })

    return (
        <PWScreen
            scroll={false}
            footerStyle={styles.footer}
            footer={
                <>
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
                </>
            }
        >
            <ScreenHeader
                icon='ledger'
                title={t('ledger.pair.title')}
                description={t('ledger.pair.description')}
            />
        </PWScreen>
    )
}
