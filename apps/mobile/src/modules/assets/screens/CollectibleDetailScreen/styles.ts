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
import { UNAVAILABLE_CONTROL_OPACITY } from '@constants/ui'

const BIG_SKELETON_HEIGHT = 300

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
    description: {
        color: theme.colors.textMain,
    },
    sectionTitle: {
        color: theme.colors.textMain,
        marginBottom: theme.spacing.md,
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
        paddingVertical: theme.spacing.xs,
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
        flexShrink: 1,
        minWidth: 0,
        marginRight: theme.spacing.md,
    },
    infoValue: {
        color: theme.colors.textMain,
    },
    infoValueLink: {
        color: theme.colors.linkPrimary,
    },
    infoValueAction: {
        color: theme.colors.positive,
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
        height: BIG_SKELETON_HEIGHT,
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
        flexShrink: 0,
    },
    mediaContainerDimmed: {
        opacity: 0.4,
    },
    unavailable: {
        opacity: UNAVAILABLE_CONTROL_OPACITY,
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
