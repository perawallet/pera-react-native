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
    container: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        // Gaps flex to the available width: the four 72px circles are
        // unshrinkable, and a fixed gap made the row wider than the popup
        // viewport (clipped ~6px per side).
        justifyContent: 'space-between',
        marginTop: theme.spacing.xl,
        width: '100%',
        overflow: 'hidden',
    },
    button: {
        // Matches the PWRoundIcon `lg` diameter so labels center under and
        // truncate at the circle's width.
        width: theme.spacing['4xl'],
        alignItems: 'center',
    },
}))
