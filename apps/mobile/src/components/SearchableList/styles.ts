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

export const useStyles = makeStyles(theme => ({
    content: {
        paddingTop: 0,
    },
    // Centers the empty component within the leftover viewport space (the
    // footer is sized to searchFooterHeight) instead of letting it sit at the
    // top. flexGrow is a fallback for the brief window before the space is
    // measured.
    emptyFill: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Opaque backing for the sticky search; without it rows scroll through the
    // transparent space around the pill (visible on iOS top overscroll).
    searchSticky: {
        backgroundColor: theme.colors.background,
    },
}))
