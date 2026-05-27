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
import { EdgeInsets } from 'react-native-safe-area-context'

type StyleProps = { insets: EdgeInsets }

export const useStyles = makeStyles((theme, { insets }: StyleProps) => ({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    heroSection: {
        backgroundColor: theme.colors.background,
    },
    toolbarTitle: {
        color: theme.colors.textMain,
        textAlign: 'center',
    },
    heroImage: {
        backgroundColor: theme.colors.dappBidali,
    },
    contentSection: {
        flexGrow: 1,
        paddingHorizontal: theme.spacing.xl,
        marginTop: theme.spacing.xl,
        backgroundColor: theme.colors.background,
    },
    // Fixed footer outside the scroll: owns the bottom safe-area inset so the
    // CTA clears the nav bar / home indicator (the sheet draws edge-to-edge).
    footer: {
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: theme.spacing.xl + insets.bottom,
        backgroundColor: theme.colors.background,
    },
}))
