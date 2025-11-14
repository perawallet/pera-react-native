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
import PWTouchableOpacity from '../touchable-opacity/PWTouchableOpacity';
import PWView from '../view/PWView';
import { useStyles } from './styles';

import DeleteIcon from '../../../../assets/icons/delete.svg';

type NumberPadProps = {
  onPress: (key?: string) => void;
};

const padArrangment = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', undefined],
];

const NumberPad = ({ onPress }: NumberPadProps) => {
  const styles = useStyles();
  return (
    <PWView style={styles.container}>
      {padArrangment.map((row, idx) => (
        <PWView style={styles.row} key={`numpad-row-${idx}`}>
          {row.map(key => (
            <PWTouchableOpacity
              key={`numpad-key-${key}`}
              onPress={() => onPress(key)}
              style={styles.key}
            >
              {!!key && <Text h2>{key}</Text>}
              {!key && <DeleteIcon width={24} height={24} />}
            </PWTouchableOpacity>
          ))}
        </PWView>
      ))}
    </PWView>
  );
};

export default NumberPad;
