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
    paddingStyle?: 'dense' | 'normal' | 'none'
    // With a center slot, both sides are forced to the wider action's width so
    // the center title stays on true screen-center; only the title truncates.
    hasCenter: boolean
    sideMinWidth: number
}

export const useStyles = makeStyles(
    (theme, { paddingStyle, hasCenter, sideMinWidth }: StyleProps) => {
        // flexShrink:0 so the action buttons never shrink — the center title
        // gives way instead.
        const sideSlot = hasCenter
            ? { flexShrink: 0, minWidth: sideMinWidth }
            : { flexShrink: 1, maxWidth: '60%' as const }
        return {
            container: {
                alignSelf: 'flex-start',
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.xs,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: paddingStyle === 'none' ? 0 : theme.spacing.md,
                minHeight: paddingStyle === 'normal' ? theme.spacing['4xl'] : 0,
            },
            leftSlotContainer: {
                ...sideSlot,
                // Row so max-width reaches the child via flexShrink: it
                // ellipsizes instead of being hard-clipped by overflow:hidden.
                flexDirection: 'row',
                alignSelf: 'center',
                alignItems: 'center',
                ...(hasCenter ? null : { minWidth: 0, overflow: 'hidden' }),
            },
            centerSlotContainer: {
                alignSelf: 'center',
                alignItems: 'center',
                justifyContent: 'center',
                flexGrow: 1,
                flexShrink: 1,
                flexBasis: 0,
                minWidth: 0,
            },
            rightSlotContainer: {
                ...sideSlot,
                alignSelf: 'center',
                flexDirection: 'row',
                justifyContent: 'flex-end',
                alignItems: 'center',
                ...(hasCenter ? null : { minWidth: 0 }),
            },
        }
    },
)
