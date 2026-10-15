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
import type { ChainNoticeKind } from './ChainNotice'

type StyleProps = { kind: ChainNoticeKind }

export const useStyles = makeStyles((theme, { kind }: StyleProps) => ({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        backgroundColor:
            kind === 'error'
                ? theme.colors.suspiciousBannerBg
                : theme.colors.warningSurface,
        borderRadius: theme.borderRadius.sm,
    },
    title: {
        flex: 1,
        color:
            kind === 'error'
                ? theme.colors.suspiciousBannerContent
                : theme.colors.warningText,
    },
}))
