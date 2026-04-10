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
    signalLevel: 'strong' | 'medium' | 'weak'
}

export const useStyles = makeStyles((theme, { signalLevel }: StyleProps) => ({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        borderBottomWidth: theme.borders.sm,
        borderBottomColor: theme.colors.layerGrayLighter,
    },
    iconContainer: {
        marginRight: theme.spacing.md,
    },
    textContainer: {
        flex: 1,
    },
    deviceName: {
        color: theme.colors.textMain,
    },
    modelName: {
        color: theme.colors.textGray,
        marginTop: theme.spacing.xs,
    },
    signalContainer: {
        marginLeft: theme.spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    signalDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor:
            signalLevel === 'strong'
                ? theme.colors.positive
                : signalLevel === 'medium'
                  ? theme.colors.warning
                  : theme.colors.textGray,
    },
}))
