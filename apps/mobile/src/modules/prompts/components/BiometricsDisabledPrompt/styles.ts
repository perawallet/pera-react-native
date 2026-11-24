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

// Full-bleed, so the insets are applied here rather than by the container.
export const useStyles = makeStyles((theme, insets: EdgeInsets) => ({
    container: {
        flex: 1,
        paddingTop: insets.top,
        paddingRight: insets.right,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        backgroundColor: theme.colors.background,
    },
    // No bottom inset: PinEditView pads its numpad clear of it.
    pinContainer: {
        flex: 1,
        paddingTop: insets.top + theme.spacing.xl,
        paddingRight: insets.right,
        paddingLeft: insets.left,
        backgroundColor: theme.colors.background,
    },
    pinToolbar: {
        minHeight: 0,
        paddingBottom: theme.spacing.xl,
        paddingTop: 0,
    },
}))
