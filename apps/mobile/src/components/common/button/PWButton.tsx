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

import { Text } from '@rneui/themed';
import { useStyles } from './styles';
import PWIcon, { IconName } from '../icons/PWIcon';
import PWTouchableOpacity from '../touchable-opacity/PWTouchableOpacity';
import { StyleProp, ViewStyle } from 'react-native';

export type PWButtonProps = {
  variant: 'primary' | 'secondary' | 'helper' | 'link' | 'destructive';
  title?: string;
  icon?: IconName;
  onPress?: () => void;
  minWidth?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  dense?: boolean;
};

const PWButton = (props: PWButtonProps) => {
  const styles = useStyles(props);

  return (
    <PWTouchableOpacity
      style={[styles.buttonStyle, props.style]}
      onPress={props.onPress}
      disabled={props.disabled}
    >
      {!!props.icon && (
        <PWIcon
          name={props.icon}
          variant={props.variant === 'destructive' ? 'white' : props.variant}
        />
      )}
      {!!props.title && <Text style={styles.titleStyle}>{props.title}</Text>}
    </PWTouchableOpacity>
  );
};

export default PWButton;
