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
import { CONTROL_MAX_WIDTH_DP } from '@constants/ui'

const HERO_ASPECT_RATIO = 327 / 222

export const useStyles = makeStyles((theme, insets: EdgeInsets) => ({
    root: {
        flex: 1,
        alignItems: 'center',
        paddingTop: insets.top,
        paddingBottom: insets.bottom + theme.spacing.sm,
        paddingHorizontal: theme.spacing.xl,
        backgroundColor: theme.colors.backdropModalBg,
    },
    card: {
        flex: 1,
        width: '100%',
        maxWidth: CONTROL_MAX_WIDTH_DP,
        borderRadius: theme.borderRadius.lg,
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
    },
    scrollArea: {
        flex: 1,
    },
    content: {
        paddingBottom: theme.spacing.xl,
    },
    hero: {
        width: '100%',
        aspectRatio: HERO_ASPECT_RATIO,
    },
    body: {
        paddingHorizontal: theme.spacing.xl,
        gap: theme.spacing.xl + theme.spacing.sm,
    },
    header: {
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    badge: {
        // PWChip pins itself to flex-start, overriding the header's centering.
        alignSelf: 'center',
        marginBottom: theme.spacing.xs,
    },
    title: {
        textAlign: 'center',
    },
    description: {
        textAlign: 'center',
        color: theme.colors.textGray,
    },
    footer: {
        paddingHorizontal: theme.spacing.xl + theme.spacing.sm,
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.xl + theme.spacing.sm,
    },
}))
