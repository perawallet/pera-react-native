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

export const useStyles = makeStyles(theme => ({
    warning: {
        gap: theme.spacing.md,
        marginVertical: theme.spacing.lg,
        backgroundColor: theme.colors.suspiciousBannerBg,
        padding: theme.spacing.lg,
        borderRadius: theme.spacing.sm,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    title: {
        flexShrink: 1,
        color: theme.colors.suspiciousBannerContent,
    },
    body: {
        color: theme.colors.suspiciousBannerContent,
    },
    comparison: {
        gap: theme.spacing.xs,
    },
    label: {
        color: theme.colors.textGray,
    },
    address: {
        color: theme.colors.textMain,
    },
    difference: {
        color: theme.colors.suspiciousBannerContent,
        textDecorationLine: 'underline',
    },
    acknowledge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    acknowledgeLabel: {
        flexShrink: 1,
    },
    firstSend: {
        marginVertical: theme.spacing.lg,
    },
    checking: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        marginVertical: theme.spacing.lg,
    },
}))
