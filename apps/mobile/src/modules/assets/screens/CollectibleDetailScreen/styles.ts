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
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    scrollContent: {
        paddingBottom: theme.spacing.xxl,
    },
    contentContainer: {
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.xl,
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
        textAlign: 'center',
    },
    accountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    accountAddress: {
        color: theme.colors.textMain,
    },
    description: {
        color: theme.colors.textMain,
    },
    sectionTitle: {
        color: theme.colors.textMain,
        marginBottom: theme.spacing.sm,
    },
    traitsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.sm,
    },
    traitItem: {
        backgroundColor: theme.colors.layerGrayLighter,
        borderRadius: theme.borderRadius.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
    },
    traitLabel: {
        color: theme.colors.textGrayLighter,
        textTransform: 'uppercase',
    },
    infoSection: {
        gap: theme.spacing.md,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    infoLabel: {
        color: theme.colors.textGray,
    },
    infoValue: {
        color: theme.colors.textMain,
    },
    infoValueLink: {
        color: theme.colors.linkPrimary,
    },
    infoDivider: {
        marginVertical: 0,
    },
    explorerRow: {
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
    skeletonContainer: {
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.xl,
        alignItems: 'center',
    },
    bigSkeleton: {
        width: '80%',
        height: 300,
        borderRadius: theme.borderRadius.lg,
        marginBottom: theme.spacing.xl,
    },
    skeleton: {
        width: '90%',
        height: theme.spacing.xxl,
        borderRadius: theme.borderRadius.md,
        marginBottom: theme.spacing.sm,
    },
    quantityChip: {
        alignSelf: 'center',
        marginLeft: theme.spacing.sm,
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
