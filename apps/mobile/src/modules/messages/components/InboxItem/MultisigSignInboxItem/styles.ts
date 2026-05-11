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

export const useStyles = makeStyles(theme => ({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.md,
    },
    indicatorSlot: {
        height: theme.spacing.xxl,
        justifyContent: 'center',
    },
    content: {
        flex: 1,
        gap: theme.spacing.sm,
    },
    title: {
        flexShrink: 1,
        flexWrap: 'wrap',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        flexWrap: 'wrap',
    },
    statusTextWaiting: {
        color: theme.colors.alertNegative,
    },
    statusTextFailure: {
        color: theme.colors.alertNegative,
    },
    statusTextSuccess: {
        color: theme.colors.positive,
    },
    timestamp: {
        color: theme.colors.textGray,
    },
    badgeRow: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
        flexWrap: 'wrap',
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.spacing.xl,
        backgroundColor: theme.colors.layerGrayLighter,
    },
    badgeText: {
        color: theme.colors.textMain,
    },
}))
