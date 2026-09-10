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
import type { EdgeInsets } from 'react-native-safe-area-context'

type StyleProps = {
    insets: EdgeInsets
    /** Left undefined while no list is shown, so the sheet hugs its content. */
    sheetHeight: number | undefined
}

export const useStyles = makeStyles(
    (theme, { insets, sheetHeight }: StyleProps) => ({
        // The activity's window is transparent and full-bleed so this screen can
        // draw its own scrim. Without an opaque sheet below, the requesting app
        // shows through Pera's own text and the user cannot tell which pixels
        // belong to which app.
        backdrop: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        scrim: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.colors.backdropModalBg,
        },
        sheet: {
            // Definite, not a max: a FlashList measures to zero inside a
            // content-sized parent, so the sheet has to commit to a height before
            // the list can have one. Undefined whenever there is no list to bound.
            height: sheetHeight,
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: theme.borderRadius.lg,
            borderTopRightRadius: theme.borderRadius.lg,
            paddingHorizontal: theme.spacing.xl,
            paddingTop: theme.spacing.lg,
            paddingBottom: insets.bottom + theme.spacing.lg,
            gap: theme.spacing.sm,
        },
        caller: {
            color: theme.colors.textGray,
        },
        host: {
            color: theme.colors.textGray,
        },
        list: {
            flex: 1,
        },
        empty: {
            color: theme.colors.textGray,
            paddingVertical: theme.spacing.lg,
        },
        unlock: {
            marginTop: theme.spacing.lg,
        },
        cancel: {
            marginTop: theme.spacing.sm,
        },
    }),
)
