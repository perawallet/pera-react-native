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

import { useStyles } from './styles';
import { TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { Text } from '@rneui/themed';
import PeraView from '../view/PeraView';

export type PanelButtonProps = {
  leftIcon: React.ReactElement<{}>;
  rightIcon: React.ReactElement<{}>;
  title: string;
  titleWeight: 'h3' | 'h4';
  onPress: () => void;
} & TouchableOpacityProps;

const PanelButton = (props: PanelButtonProps) => {
  const themeStyle = useStyles(props);
  const { style, leftIcon, rightIcon, title, titleWeight, onPress, ...rest } =
    props;

  return (
    <TouchableOpacity onPress={onPress}>
      <PeraView style={[style, themeStyle.buttonStyle]} {...rest}>
        {leftIcon}
        <Text
          style={themeStyle.textStyle}
          h4={titleWeight === 'h4'}
          h3={titleWeight === 'h3'}
        >
          {title}
        </Text>
        {rightIcon}
      </PeraView>
    </TouchableOpacity>
  );
};

export default PanelButton;
