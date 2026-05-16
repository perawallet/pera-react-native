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
import type { PWResultViewVariant } from './PWResultView'

const ICON_CIRCLE_SIZE = 64

type StyleProps = { variant: PWResultViewVariant }

export const useStyles = makeStyles((theme, { variant }: StyleProps) => {
    const circleBackground =
        variant === 'success' ? theme.colors.positive : theme.colors.negative

    return {
        container: {
            flex: 1,
            paddingHorizontal: theme.spacing.md,
        },
        content: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        iconCircle: {
            width: ICON_CIRCLE_SIZE,
            height: ICON_CIRCLE_SIZE,
            borderRadius: ICON_CIRCLE_SIZE / 2,
            backgroundColor: circleBackground,
            justifyContent: 'center',
            alignItems: 'center',
        },
        title: {
            marginTop: theme.spacing.xl,
            textAlign: 'center',
        },
        body: {
            marginTop: theme.spacing.sm,
            color: theme.colors.textGray,
            textAlign: 'center',
        },
        footer: {
            gap: theme.spacing.md,
        },
    }
})
