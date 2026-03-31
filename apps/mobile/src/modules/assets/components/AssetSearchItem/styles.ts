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

type StyleProps = {
    isOptedIn: boolean
}

export const useStyles = makeStyles((theme, { isOptedIn }: StyleProps) => ({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.md,
        opacity: isOptedIn ? 0.5 : 1,
    },
    iconContainer: {
        width: theme.spacing.xl,
        height: theme.spacing.xl,
        borderRadius: theme.spacing.xl / 2,
        backgroundColor: theme.colors.layerGrayLighter,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    infoContainer: {
        flex: 1,
        marginLeft: theme.spacing.sm,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    unitName: {
        marginLeft: theme.spacing.xs,
        color: theme.colors.textGray,
    },
    secondaryText: {
        color: theme.colors.textGray,
    },
    actionContainer: {
        marginLeft: theme.spacing.sm,
    },
}))
