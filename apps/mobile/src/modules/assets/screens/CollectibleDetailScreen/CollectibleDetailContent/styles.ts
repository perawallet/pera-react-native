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
    container: {
        backgroundColor: theme.colors.background,
    },
    contentContainer: {
        paddingHorizontal: theme.spacing.xl,
        gap: theme.spacing.xl,
    },
    titleSection: {
        gap: theme.spacing.xs,
    },
    title: {
        color: theme.colors.textMain,
    },
    collectionName: {
        color: theme.colors.textGray,
    },
    accountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    actionButtonsContainer: {
        flexDirection: 'row',
        gap: theme.spacing.xl,
        alignItems: 'center',
        alignSelf: 'center',
        paddingHorizontal: theme.spacing.lg,
    },
    quantityChip: {
        alignSelf: 'center',
        marginLeft: theme.spacing.sm,
        flexShrink: 0,
    },
    mediaContainerDimmed: {
        opacity: 0.4,
    },
    optOutNotice: {
        gap: theme.spacing.md,
    },
    optOutNoticeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        marginVertical: theme.spacing.sm,
    },
    optOutNoticeText: {
        color: theme.colors.textGrayLighter,
        flexShrink: 1,
    },
}))
