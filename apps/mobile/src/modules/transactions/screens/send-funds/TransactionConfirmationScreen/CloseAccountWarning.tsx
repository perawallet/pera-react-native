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

import { PWRoundIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { makeStyles } from '@rneui/themed'

export const CloseAccountWarning = () => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView
            style={styles.container}
            testID='close_account_warning'
        >
            <PWRoundIcon
                icon='trash'
                size='md'
                variant='error'
            />
            <PWView style={styles.messageContainer}>
                <PWText style={styles.message}>
                    {t('send_funds.close_account.warning')}
                </PWText>
            </PWView>
        </PWView>
    )
}

const useStyles = makeStyles(theme => ({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.lg,
        marginVertical: theme.spacing.xl,
        backgroundColor: theme.colors.suspiciousBannerBg,
        padding: theme.spacing.lg,
        borderRadius: theme.spacing.sm,
    },
    messageContainer: {
        flexShrink: 1,
        gap: theme.spacing.xs,
    },
    message: {
        flexShrink: 1,
        color: theme.colors.suspiciousBannerContent,
    },
}))
