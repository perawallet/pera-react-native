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

export const useStyles = makeStyles(theme => {
    const BADGE_SIZE = theme.spacing.lg * 2

    return {
        avatarWrapper: {
            alignItems: 'center',
            marginTop: theme.spacing.lg,
            marginBottom: theme.spacing['4xl'],
            gap: theme.spacing.xl,
        },
        avatarTouchable: {
            position: 'relative',
        },
        avatarBadge: {
            position: 'absolute',
            top: 0,
            right: 0,
            width: BADGE_SIZE,
            height: BADGE_SIZE,
            borderRadius: BADGE_SIZE / 2,
            backgroundColor: theme.colors.buttonPrimaryBg,
            alignItems: 'center',
            justifyContent: 'center',
        },
        addPhotoLabel: {
            color: theme.colors.textMain,
            textAlign: 'center',
        },
        formContainer: {
            gap: theme.spacing.xl,
        },
        nfdStatus: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
        },
        nfdStatusText: {
            color: theme.colors.textGray,
        },
        scanIconWrapper: {
            marginLeft: theme.spacing.sm,
        },
    }
})
