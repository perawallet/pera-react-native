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
import type { KeyValueAlignment } from './KeyValueAlignmentContext'
import type { KeyValueRowProps } from './KeyValueRow'

type StyleProps = KeyValueRowProps & { alignment: KeyValueAlignment }

export const useStyles = makeStyles((theme, props: StyleProps) => ({
    container: {
        flexDirection: 'row',
        // A detail card's label sits level with a wrapped value's first line.
        alignItems:
            props.verticalAlignment === 'top' || props.alignment === 'end'
                ? 'flex-start'
                : 'center',
        flexWrap: 'nowrap',
        width: '100%',
        minWidth: 0,
        overflow: 'hidden',
        gap: theme.spacing.md,
    },
    labelContainer: {
        flexBasis: '38%',
        maxWidth: '38%',
        minWidth: 0,
        flexShrink: 1,
        overflow: 'hidden',
        // The label's 16px line, centred on a value's 24px first line, so a
        // top-aligned row doesn't sit the label 4px above its value.
        ...(props.alignment === 'end' && {
            minHeight: theme.spacing.xl,
            justifyContent: 'center',
        }),
    },
    label: {
        color: theme.colors.textGray,
    },
    childContainer: {
        alignItems: props.alignment === 'end' ? 'flex-end' : 'stretch',
        alignSelf: 'stretch',
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
    },
}))
