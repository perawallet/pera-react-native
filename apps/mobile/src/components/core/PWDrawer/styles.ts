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

import { PWDRAWER_EDGE_WIDTH } from './constants'

type StyleProps = {
    panelWidth: number
    edgeWidth?: number
}

export const useStyles = makeStyles(
    (theme, { panelWidth, edgeWidth = PWDRAWER_EDGE_WIDTH }: StyleProps) => ({
        host: {
            flex: 1,
            backgroundColor: theme.colors.background,
            overflow: 'hidden',
        },
        // Pinned beneath the content and left there: in `back` the panel never
        // moves, so revealing it is purely the content sliding off it.
        //
        // A recessed off-white, so the layer underneath reads as recessed.
        // Watch the account rows: AccountWithBalance is itself
        // layerGrayLightest, so on this panel they lose their card edge.
        panel: {
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: panelWidth,
        },
        // Grows out from the leading edge rather than the middle, so the panel's
        // left margin stays put while the content expands into the space the
        // sliding screen is vacating.
        panelContent: {
            flex: 1,
            transformOrigin: 'left center',
        },
        // Opaque on purpose — it has to hide the panel underneath while closed.
        content: {
            flex: 1,
            backgroundColor: theme.colors.background,
        },
        // Offset leftwards so the content reads as the upper layer. Opacity and
        // elevation are animated with drag progress, so they're absent here.
        // iOS honours the direction; Android's elevation shadow is symmetric,
        // so there it reads as a lift rather than a left-cast shadow.
        contentShadow: {
            shadowColor: theme.shadows.md.shadowColor,
            shadowOffset: { width: -theme.spacing.xxs, height: 0 },
            shadowRadius: theme.spacing.xs,
        },
        // Sits over the content, so once open it tints only the sliver still on
        // screen — reading as shading at the seam rather than a modal backdrop.
        scrim: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.shadows.md.shadowColor,
        },
        edgeStrip: {
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: edgeWidth,
        },
        // Only the content still visible beside the open panel. Stopping at the
        // panel's edge is what keeps the account list scrollable and tappable.
        contentSliver: {
            position: 'absolute',
            left: panelWidth,
            right: 0,
            top: 0,
            bottom: 0,
        },
    }),
)
