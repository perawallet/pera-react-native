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
import type { AccountDisplayProps } from './AccountDisplay'

// Card-art thumbnail dims (fixed card ratio — no runtime aspect-ratio
// derivation, per the project's image-sizing convention).
const CARD_THUMB_WIDTH = 48
const CARD_THUMB_HEIGHT = 30

export const useStyles = makeStyles(
    (theme, { noBorder }: AccountDisplayProps) => {
        const addressText = {
            color: theme.colors.textGray,
        }
        return {
            container: {
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                flexShrink: 1,
                minWidth: 0,
                ...(noBorder && {
                    borderWidth: 0,
                }),
            },
            textContainer: {
                flexShrink: 1,
                minWidth: 0,
                justifyContent: 'center',
            },
            text: {
                color: theme.colors.textMain,
            },
            // Card-art thumbnail shown in place of the account icon when the
            // `card` prop is set.
            cardThumb: {
                width: CARD_THUMB_WIDTH,
                height: CARD_THUMB_HEIGHT,
                borderRadius: theme.spacing.xs,
                // PWImage puts `style` on an outer View, so clip the inner image
                // to make the rounded corners actually show.
                overflow: 'hidden',
            },
            // Backup-required badge pinned to the icon's bottom-right corner.
            // The disc's background shows through the glyph's inset stroke as
            // the ring that separates it from the account icon underneath.
            backupBadge: {
                position: 'absolute',
                bottom: -theme.spacing.xxs,
                right: -theme.spacing.xxs,
                backgroundColor: theme.colors.background,
                borderRadius: theme.spacing.lg,
            },
            addressText,
        }
    },
)
