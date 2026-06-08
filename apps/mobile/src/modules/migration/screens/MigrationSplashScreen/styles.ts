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
import bootsplashManifest from '@assets/bootsplash/manifest.json'

// The splash screen visually continues the native bootsplash, so its colors
// must match the bootsplash manifest verbatim and intentionally bypass the
// theme tokens — switching to dark-mode tokens here would create a seam at
// hand-off from native to JS.
const BOOTSPLASH_FOREGROUND = '#000000'
const LOGO_SIZE = bootsplashManifest.logo.width

export const useStyles = makeStyles(theme => ({
    container: {
        flex: 1,
        backgroundColor: bootsplashManifest.background,
    },
    logoLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logo: {
        width: LOGO_SIZE,
        height: LOGO_SIZE,
    },
    footer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: theme.spacing['3xl'],
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.xl,
    },
    footerMessage: {
        textAlign: 'center',
        color: BOOTSPLASH_FOREGROUND,
    },
    continueButton: {
        alignSelf: 'stretch',
    },
}))

export const SPINNER_COLOR = BOOTSPLASH_FOREGROUND
