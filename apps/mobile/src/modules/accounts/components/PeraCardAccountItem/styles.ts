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
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        width: '100%',
        backgroundColor: theme.colors.layerGrayLightest,
        borderWidth: theme.borders.sm,
        borderRadius: theme.spacing.lg,
        padding: theme.spacing.lg,
    },
    dashedBorder: {
        borderStyle: 'dashed',
        borderColor: theme.colors.textGrayLighter,
    },
    solidBorder: {
        borderColor: theme.colors.layerGray,
    },
    leftBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        flex: 1,
        minWidth: 0,
    },
    textBlock: {
        flexShrink: 1,
        minWidth: 0,
    },
    // Keep the Activate button at its natural width; the title/subtitle
    // truncate instead of squeezing the button.
    activateButton: {
        flexShrink: 0,
    },
    subtitle: {
        color: theme.colors.textGray,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    statusLabel: {
        color: theme.colors.textGrayLighter,
    },
    // Activated state: indent the card and draw an approximate L-connector up
    // toward the account it is nested under (not a pixel-perfect match).
    nestedWrapper: {
        position: 'relative',
        paddingLeft: theme.spacing['4xl'],
    },
    connector: {
        position: 'absolute',
        left: theme.spacing.xl,
        top: -theme.spacing.md,
        width: theme.spacing.xl,
        height: theme.spacing['3xl'],
        borderLeftWidth: theme.borders.sm,
        borderBottomWidth: theme.borders.sm,
        borderColor: theme.colors.layerGray,
        borderBottomLeftRadius: theme.spacing.md,
    },
}))
