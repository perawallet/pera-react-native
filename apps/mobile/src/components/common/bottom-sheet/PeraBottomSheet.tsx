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

import { BottomSheet, BottomSheetProps } from '@rneui/themed';
import PeraView from '../view/PeraView';
import { PropsWithChildren } from 'react';
import { useStyles } from './styles';
import { StyleProp, ViewStyle } from 'react-native';

type PeraBottomSheetProps = {
  innerContainerStyle?: StyleProp<ViewStyle>;
} & BottomSheetProps &
  PropsWithChildren;

const PeraBottomSheet = ({
  innerContainerStyle,
  children,
  ...rest
}: PeraBottomSheetProps) => {
  const style = useStyles();
  return (
    <BottomSheet {...rest}>
      <PeraView style={[style.defaultStyle, innerContainerStyle]}>
        {children}
      </PeraView>
    </BottomSheet>
  );
};

export default PeraBottomSheet;
