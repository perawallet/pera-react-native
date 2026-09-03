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
import type { EdgeInsets } from 'react-native-safe-area-context'

const HEADER_IMAGE_SCREEN_RATIO = 1 / 4

// welcome-background.webp intrinsic dimensions; hardcoded to avoid resolveAssetSource.
const IMAGE_ASPECT_RATIO = 344 / 544

type StyleProps = {
    insets: EdgeInsets
    screenHeight: number
}

export const useStyles = makeStyles((theme, props: StyleProps) => {
    const { insets, screenHeight } = props
    const headerImageHeight =
        screenHeight * HEADER_IMAGE_SCREEN_RATIO + insets.top

    return {
        rootContainer: {
            flex: 1,
            flexDirection: 'column',
            gap: theme.spacing['3xl'],
        },
        headerContainer: {
            width: '100%',
            height: headerImageHeight,
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
            right: 0,
            height: headerImageHeight,
            aspectRatio: IMAGE_ASPECT_RATIO,
            resizeMode: 'contain',
        },
        buttonTitle: {
            marginTop: theme.spacing.xl,
            marginBottom: theme.spacing.sm,
            color: theme.colors.textGray,
        },
        mainContainer: {
            backgroundColor: theme.colors.background,
            color: theme.colors.textWhite,
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
