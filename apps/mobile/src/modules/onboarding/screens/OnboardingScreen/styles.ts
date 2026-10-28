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
import { getFontWeightVariant } from '@theme/typography'

// Design frame is 375x812 including the status bar: the title ends 308pt down,
// and the header art (gradient and logo flattened per theme, fading into the
// screen colour) is 375x492 at the very top.
const TITLE_BOTTOM_SCREEN_RATIO = 308 / 812
const HEADER_IMAGE_ASPECT_RATIO = 375 / 492

type StyleProps = {
    screenWidth: number
    screenHeight: number
}

export const useStyles = makeStyles((theme, props: StyleProps) => {
    const { screenWidth, screenHeight } = props

    return {
        rootContainer: {
            flex: 1,
            flexDirection: 'column',
            gap: theme.spacing['3xl'],
        },
        headerContainer: {
            width: '100%',
            height: screenHeight * TITLE_BOTTOM_SCREEN_RATIO,
            position: 'relative',
        },
        headerTitle: {
            position: 'absolute',
            left: theme.spacing.xl,
            right: theme.spacing.xl,
            bottom: 0,
            zIndex: 1,
            ...getFontWeightVariant(theme, 'h1', 600),
        },
        headerImage: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: screenWidth,
            aspectRatio: HEADER_IMAGE_ASPECT_RATIO,
        },
        buttonTitle: {
            marginTop: theme.spacing.xl,
            marginBottom: theme.spacing.sm,
            color: theme.colors.textGray,
        },
        mainContainer: {
            paddingHorizontal: theme.spacing.xl,
            flexDirection: 'column',
        },
        footerContainer: {
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingHorizontal: theme.spacing.xl,
            paddingBottom: theme.spacing['3xl'],
        },
        termsAndPrivacyText: {
            textAlign: 'center',
            color: theme.colors.textGray,
        },
    }
})
