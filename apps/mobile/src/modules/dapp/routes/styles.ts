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

export const useStyles = makeStyles(() => ({
    // The approval NavigationContainer wraps a plain surface component, not a
    // stack navigator, so — unlike WebMainRoutes — nothing injects the flex:1
    // that bounds children to the popup viewport. Without this, a tall
    // approval screen (the sign transaction review) grows to its content
    // height and overflows the fixed 600px toolbar popup (the slide-to-confirm
    // footer gets clipped below the fold with no scroll). flex:1 bounds the
    // surface to the viewport so PWScreen's body scrolls instead.
    surface: {
        flex: 1,
    },
}))
