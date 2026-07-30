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

export const useStyles = makeStyles(theme => {
    // Nesting geometry, shared by the wrapper and the connector so the elbow
    // always lands on the card's left border. `nestIndent` is how far the
    // nested card is inset; `connectorX` is where the vertical line drops.
    const nestIndent = theme.spacing['4xl']
    const connectorX = theme.spacing.xl

    return {
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
        // Activated state: indent the card and draw an L-connector up toward
        // the account it is nested under.
        nestedWrapper: {
            position: 'relative',
            paddingLeft: nestIndent,
        },
        connector: {
            position: 'absolute',
            left: connectorX,
            // The list separator is `md` tall, so a negative top of that size
            // starts the line flush with the parent card's bottom edge.
            top: -theme.spacing.md,
            // Run the elbow the whole way from the vertical line to the card's
            // left border — anything less leaves a visible floating gap.
            width: nestIndent - connectorX,
            height: theme.spacing['3xl'],
            borderLeftWidth: theme.borders.sm,
            borderBottomWidth: theme.borders.sm,
            borderColor: theme.colors.layerGray,
            borderBottomLeftRadius: theme.spacing.md,
        },
    }
})
