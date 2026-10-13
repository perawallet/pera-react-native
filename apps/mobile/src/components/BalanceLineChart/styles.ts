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
import { CHART_HEIGHT } from '@constants/ui'

export const useStyles = makeStyles(() => ({
    // Callers size the outer container (CHART_HEIGHT); the Skia canvas fills it.
    canvas: {
        flex: 1,
    },
    // Non-chart states (offline/error/etc.) carry a title, a full-sentence
    // body and sometimes a retry button — taller than the chart canvas needs.
    // Unsetting the caller's fixed height in favour of a floor lets that copy
    // grow past CHART_HEIGHT instead of overflowing it and colliding with
    // whatever renders below.
    message: {
        height: undefined,
        minHeight: CHART_HEIGHT,
    },
}))
