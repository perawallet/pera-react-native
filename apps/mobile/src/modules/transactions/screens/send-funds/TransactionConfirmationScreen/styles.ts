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

import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => {
    return {
        secondaryAmount: {
            color: theme.colors.textGray,
        },
        addContact: {
            alignSelf: 'flex-start',
            marginTop: theme.spacing.xs,
        },
        scrollContent: {
            gap: theme.spacing.xl,
            paddingTop: theme.spacing.lg,
        },
    }
})

export const useCloseAccountWarningStyles = makeStyles(theme => ({
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
