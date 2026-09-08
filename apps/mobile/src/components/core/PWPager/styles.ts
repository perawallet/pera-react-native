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
    pageWidth: number
    pageCount: number
}

export const useStyles = makeStyles(
    (_theme, { pageWidth, pageCount }: StyleProps) => ({
        viewport: {
            flex: 1,
            overflow: 'hidden',
        },
        // Wide enough to contain every page: Android's framework touch dispatch
        // clips to each view's own rect, so a one-page-wide track hides a
        // translated page's native ScrollView from the scroll gesture. Taps still
        // land there, because RN's own hit-testing tolerates the overflow.
        track: {
            flex: 1,
            flexDirection: 'row',
            width: pageWidth * pageCount,
        },
        page: {
            width: pageWidth,
        },
    }),
)
