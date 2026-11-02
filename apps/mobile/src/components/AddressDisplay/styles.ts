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

import { useContext } from 'react'
import { makeStyles } from '@rneui/themed'
import { KeyValueAlignmentContext } from '@components/KeyValueRow'

type StyleProps = {
    hugContent: boolean
}

type BaseStyleProps = StyleProps & { isEndAligned: boolean }

const useBaseStyles = makeStyles(
    (theme, { hugContent, isEndAligned }: BaseStyleProps) => {
        const secondaryText = {
            color: theme.colors.textGray,
            // No dedicated line-height token exists; theme.spacing.lg (16) is
            // reused as the caption line height to keep pixel-parity with the
            // secondary text in AccountDisplay/styles.ts.
            lineHeight: theme.spacing.lg,
        }
        const fillOrHug = hugContent ? { flexShrink: 1 } : { flex: 1 }
        return {
            addressValueContainer: {
                flexDirection: 'row',
                gap: theme.spacing.md,
                alignItems: 'center',
                minWidth: 0,
                ...fillOrHug,
                // Packed right across the full column: measured to fit instead, a
                // truncating address collapses to no width.
                ...(isEndAligned && {
                    alignSelf: 'stretch',
                    justifyContent: 'flex-end',
                }),
            },
            contentContainer: {
                minWidth: 0,
                overflow: 'hidden',
                ...fillOrHug,
            },
            copyIconContainer: {
                flexShrink: 0,
            },
            contactContainer: {
                flexDirection: 'row',
                gap: theme.spacing.md,
                alignItems: 'center',
                minWidth: 0,
                ...fillOrHug,
            },
            unifiedTextContainer: {
                flex: 1,
                minWidth: 0,
                justifyContent: 'center',
            },
            addressTextStack: {
                flex: 1,
                minWidth: 0,
                justifyContent: 'center',
            },
            // PWText only shrinks when truncating; a full address wraps, so it must shrink beside the avatar or the row clips its lines.
            unnamedAddress: {
                flexShrink: 1,
                minWidth: 0,
            },
            primaryText: {
                color: theme.colors.textMain,
            },
            secondaryText,
        }
    },
)

// A right-aligned value hugs its copy icon rather than stranding it at the far edge.
export const useStyles = ({ hugContent }: StyleProps) => {
    const isEndAligned = useContext(KeyValueAlignmentContext) === 'end'
    return useBaseStyles({
        hugContent: hugContent || isEndAligned,
        isEndAligned,
    })
}
