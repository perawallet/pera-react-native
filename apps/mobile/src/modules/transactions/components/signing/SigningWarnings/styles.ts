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
    warningContainer: {
        alignItems: 'center' as const,
        justifyContent: 'flex-start' as const,
        width: '100%',
        marginBottom: theme.spacing.md,
    },
    sheetContainer: {
        paddingBottom: theme.spacing.xxl,
        paddingHorizontal: theme.spacing.xl,
        borderTopStartRadius: theme.spacing.sm,
        borderTopEndRadius: theme.spacing.sm,
        overflow: 'hidden',
    },
    warningSection: {
        marginVertical: theme.spacing.md,
        gap: theme.spacing.xs,
    },
    warningSectionIconContainer: {
        flexShrink: 1,
        flexDirection: 'row' as const,
        alignItems: 'flex-start' as const,
        justifyContent: 'flex-start' as const,
        gap: theme.spacing.lg,
    },
    warningMessageContainer: {
        flexShrink: 1,
        gap: theme.spacing.xs,
    },
    warningMessage: {
        flexShrink: 1,
    },
    senderText: {
        color: theme.colors.textGray,
    },
    divider: {
        marginVertical: theme.spacing.md,
        width: '100%',
    },
}))
