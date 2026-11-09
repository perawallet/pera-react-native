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

type StyleProps = {
    hasHighRisk: boolean
}

export const useStyles = makeStyles((theme, { hasHighRisk }: StyleProps) => ({
    container: {
        gap: theme.spacing.md,
        padding: theme.spacing.lg,
        borderRadius: theme.spacing.sm,
        backgroundColor: hasHighRisk
            ? theme.colors.suspiciousBannerBg
            : theme.colors.warningSurface,
    },
    // The panel's own header margin is for a standalone list row.
    panelHeader: {
        marginTop: 0,
    },
    summaryContainer: {
        flex: 1,
        minWidth: 0,
    },
    rows: {
        gap: theme.spacing.md,
    },
    foldedRows: {
        gap: theme.spacing.md,
        paddingTop: theme.spacing.md,
    },
    title: {
        color: theme.colors.textMain,
    },
    row: {
        gap: theme.spacing.xs,
    },
}))

export const useReviewWarningTextStyles = makeStyles(theme => ({
    text: {
        color: theme.colors.textMain,
    },
}))
