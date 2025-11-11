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

import { NativeStackHeaderProps } from '@react-navigation/native-stack';
import PeraView from '../view/PeraView';
import { Text } from '@rneui/themed';
import ChevronLeft from '../../../../assets/icons/chevron-left.svg';
import { useStyles } from './styles';
import { TouchableOpacity } from 'react-native';

const NavigationHeader = (props: NativeStackHeaderProps) => {
  const styles = useStyles();

  return (
    <PeraView style={styles.container}>
      {props.navigation.canGoBack() && (
        <TouchableOpacity
          onPress={props.navigation.goBack}
          style={styles.backIconContainer}
        >
          <ChevronLeft style={styles.backIcon} />
        </TouchableOpacity>
      )}
      <Text h4 style={styles.title}>
        {props.options.title || props.route.name}
      </Text>
      {props.options.headerRight && (
        <PeraView style={styles.actionContainer}>
          {props.options.headerRight({})}
        </PeraView>
      )}
      {!props.options.headerRight && props.navigation.canGoBack() && (
        <PeraView style={styles.backIconContainer} />
      )}
    </PeraView>
  );
};

export default NavigationHeader;
