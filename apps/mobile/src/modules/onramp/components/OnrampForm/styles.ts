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
    // Page margin is small (sm); each section below adds `lg` so its content
    // lines up at sm+lg. The "You receive" grey card spans this full width and
    // keeps the `lg` inside the box (see OnrampAmountSection), so pay/receive
    // content align even though the grey surround is wider.
    formContainer: {
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.lg,
        gap: theme.spacing.md,
    },
    receiveWrapper: {
        position: 'relative',
    },
    // Floats the MIN|MAX pill so it straddles the top-right edge of the gray
    // receive card (overlapping the pay/receive boundary).
    minMaxPill: {
        position: 'absolute',
        top: -theme.spacing.lg,
        right: theme.spacing.md,
        zIndex: 1,
    },
    rows: {
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
    },
    senderRow: {
        paddingHorizontal: theme.spacing.lg,
    },
    errorContainer: {
        paddingTop: theme.spacing.xs,
        paddingHorizontal: theme.spacing.lg,
    },
    errorText: {
        color: theme.colors.negative,
    },
    buyButton: {
        marginTop: theme.spacing.sm,
        marginHorizontal: theme.spacing.lg,
    },
}))
