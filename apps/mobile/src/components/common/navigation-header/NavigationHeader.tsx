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
import PWView from '../view/PWView';
import { Text } from '@rneui/themed';
import { useStyles } from './styles';
import PWIcon from '../icons/PWIcon';

const NavigationHeader = (props: NativeStackHeaderProps) => {
  const styles = useStyles();

  return (
    <PWView style={styles.container}>
      <PWView style={styles.backIconContainer}>
        {!!props.navigation.canGoBack() && (
          <PWIcon name="chevron-left" onPress={props.navigation.goBack} />
        )}
      </PWView>
      <Text h4 style={styles.title}>
        {props.options.title || props.route.name}
      </Text>
      <PWView style={styles.backIconContainer}>
        {props.options?.headerRight?.({})}
      </PWView>
    </PWView>
  );
};

export default NavigationHeader;
