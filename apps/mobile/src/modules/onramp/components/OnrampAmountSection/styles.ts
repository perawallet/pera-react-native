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
import { getTypography } from '@theme/typography'

type StyleProps = { variant: 'pay' | 'receive' }

export const useStyles = makeStyles((theme, { variant }: StyleProps) => ({
    container:
        variant === 'pay'
            ? {
                  // `lg` inset matches the `lg` inside the receive grey card so
                  // the pay/receive amounts line up at the same left edge.
                  paddingHorizontal: theme.spacing.lg,
              }
            : {
                  // Grey card spans the full section width; the `lg` padding is
                  // INSIDE the box so its content aligns with the pay section.
                  backgroundColor: theme.colors.layerGrayLighter,
                  borderRadius: theme.borderRadius.xl,
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.lg,
              },
    label: {
        color: theme.colors.textGray,
        marginBottom: theme.spacing.sm,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
    },
    amountContainer: {
        flex: 1,
        minHeight: getTypography(theme, 'h1').lineHeight,
        justifyContent: 'center',
    },
    amountText: getTypography(theme, 'h1'),
    amountTextMuted: {
        ...getTypography(theme, 'h1'),
        color: theme.colors.textGrayLighter,
    },
    amountInputContainer: {
        paddingHorizontal: 0,
    },
    amountInputInnerContainer: {
        borderBottomWidth: 0,
        paddingHorizontal: 0,
        backgroundColor: 'transparent',
    },
    amountInput: {
        paddingLeft: 0,
    },
    fiatValueContainer: {
        minHeight: getTypography(theme, 'body').lineHeight,
        justifyContent: 'center',
        marginTop: theme.spacing.xs,
    },
    fiatValue: {
        color: theme.colors.textGray,
    },
}))
