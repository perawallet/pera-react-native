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

type StyleProps = {
    paddingStyle?: 'dense' | 'normal' | 'none'
    // When a center slot is present, both side slots are forced to the same
    // width (the wider action, measured at runtime — see usePWToolbar) so the
    // center title stays on true screen-center while the action buttons keep
    // their full size. The title is the only slot that truncates. Without a
    // center, the left slot hugs its content (e.g. the account toolbar's wide
    // selector) and the center grows to push the right action to the edge.
    hasCenter: boolean
    // Width of the widest side action; applied to both side slots so they match
    // and the center stays truly centered. Only used when `hasCenter`.
    sideMinWidth: number
}

export const useStyles = makeStyles(
    (theme, { paddingStyle, hasCenter, sideMinWidth }: StyleProps) => {
        // Action slots: content-sized and flexShrink:0 so the buttons never
        // shrink or ellipsize — the center title gives way instead. With a
        // center, both sides also take minWidth:sideMinWidth so they resolve to
        // the same width and the center sits dead-center between them.
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
                // Row so the slot's max-width propagates to the child via
                // flexShrink: the content (e.g. the account selector's name)
                // truncates with an ellipsis instead of being hard-clipped by
                // overflow:hidden, keeping a trailing chevron visible.
                flexDirection: 'row',
                alignSelf: 'center',
                alignItems: 'center',
                ...(hasCenter ? null : { minWidth: 0, overflow: 'hidden' }),
            },
            centerSlotContainer: {
                alignSelf: 'center',
                alignItems: 'center',
                justifyContent: 'center',
                // Takes all space the action slots leave and truncates within
                // it, so a long title never pushes the buttons off screen.
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
