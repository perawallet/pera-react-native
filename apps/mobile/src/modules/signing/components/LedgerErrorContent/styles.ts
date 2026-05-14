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

import { makeStyles } from '@rneui/themed'
import { getTypography } from '@theme/typography'

export const useStyles = makeStyles(theme => ({
    container: {
        padding: theme.spacing.xl,
        alignItems: 'center',
    },
    title: {
        ...getTypography(theme, 'h3'),
        marginBottom: theme.spacing.sm,
        textAlign: 'center',
    },
    body: {
        ...getTypography(theme, 'body'),
        color: theme.colors.textGray,
        textAlign: 'center',
        marginBottom: theme.spacing.lg,
        paddingHorizontal: theme.spacing.lg,
    },
    troubleshootLink: {
        ...getTypography(theme, 'body'),
        color: theme.colors.linkPrimary,
        textAlign: 'center',
        marginBottom: theme.spacing.xl,
        textDecorationLine: 'underline',
    },
    actions: {
        width: '100%',
        gap: theme.spacing.sm,
    },
    retryButton: {
        marginBottom: theme.spacing.xs,
    },
}))
