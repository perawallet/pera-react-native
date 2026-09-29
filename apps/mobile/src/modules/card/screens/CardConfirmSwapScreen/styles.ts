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
    summaryPill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: theme.spacing.sm,
        backgroundColor: theme.colors.layerGrayLighter,
        borderRadius: theme.spacing.sm,
        padding: theme.spacing.md,
    },
    assetGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    stepsCard: {
        marginTop: theme.spacing.xl,
        padding: theme.spacing.lg,
        gap: theme.spacing.lg,
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.divider,
        borderRadius: theme.spacing.md,
    },
    note: {
        color: theme.colors.textGray,
    },
    detailsTitle: {
        marginTop: theme.spacing.xxl,
        marginBottom: theme.spacing.xs,
        color: theme.colors.textGray,
    },
    detailRow: {
        paddingVertical: theme.spacing.md,
        borderBottomWidth: theme.borders.sm,
        borderBottomColor: theme.colors.divider,
    },
    value: {
        textAlign: 'right',
    },
}))
