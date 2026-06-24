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
    feeContainer: {
        paddingBottom: theme.spacing.md,
    },
    listHeader: {
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.xl,
    },
    listSubheaderText: {
        color: theme.colors.textGray,
        marginBottom: theme.spacing.sm,
        paddingTop: theme.spacing.md,
    },
    groupPreviewContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.layerGrayLighter,
        borderRadius: theme.spacing.lg,
        padding: theme.spacing.lg,
        paddingVertical: theme.spacing.lg,
        gap: theme.spacing.md,
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGray,
    },
    groupPreviewContent: {
        flex: 1,
    },
    groupPreviewSubtitle: {
        color: theme.colors.textGray,
    },
    groupPreviewSubtitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.lg,
    },
    balanceImpactContainer: {
        paddingVertical: theme.spacing.lg,
    },
}))
