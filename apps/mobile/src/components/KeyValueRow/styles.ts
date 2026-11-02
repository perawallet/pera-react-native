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
import type { KeyValueRowProps } from './KeyValueRow'

type StyleProps = KeyValueRowProps & { isDetail: boolean }

export const useStyles = makeStyles((theme, props: StyleProps) => ({
    container: {
        flexDirection: 'row',
        alignItems: props.verticalAlignment === 'top' ? 'flex-start' : 'center',
        flexWrap: 'nowrap',
        width: '100%',
        minWidth: 0,
        overflow: 'hidden',
        gap: theme.spacing.md,
    },
    // A detail label keeps its natural width, so "Transaction Note" isn't cut at 38%.
    labelContainer: {
        flexBasis: props.isDetail ? 'auto' : '38%',
        maxWidth: props.isDetail ? '50%' : '38%',
        minWidth: 0,
        flexShrink: 1,
        overflow: 'hidden',
    },
    label: {
        color: props.isDetail ? theme.colors.textMain : theme.colors.textGray,
    },
    childContainer: {
        alignItems: props.isDetail ? 'flex-end' : 'stretch',
        alignSelf: 'stretch',
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
    },
}))
