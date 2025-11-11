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

import { ParamListBase, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStyles } from './styles';
import { Input, Overlay, Text, useTheme } from '@rneui/themed';
import PWView from '../../components/common/view/PWView';
import PWButton from '../../components/common/button/PWButton';
import MainScreenLayout from '../../layouts/MainScreenLayout';

import { useImportWallet } from '@perawallet/core';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import useToast from '../../hooks/toast';

const NUM_WORDS = 24; //TODO: we'll add legacy 25 word accounts later

const ImportAccountScreen = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const styles = useStyles();
  const importWallet = useImportWallet();
  const { showToast } = useToast();

  const [words, setWords] = useState<string[]>(new Array(NUM_WORDS).fill(''));
  const [focused, setFocused] = useState(0);
  const [canImport, setCanImport] = useState(false);
  const [processing, setProcessing] = useState(false);

  const updateWord = (word: string, index: number) => {
    const splitWords = word.split('\n');

    if (splitWords.length === NUM_WORDS) {
      setWords(splitWords);
    } else {
      setWords(prev => {
        prev[index] = word.trim();
        return [...prev];
      });
    }

    if (words.every(w => w.length)) {
      setCanImport(true);
    }
  };

  const handleImportAccount = () => {
    setProcessing(true);
    setTimeout(() => {
      try {
        importWallet({ mnemonic: words.join(' ') });
        goToHome();
      } catch (error) {
        showToast({
          title: 'Import failed',
          body: 'There was an error trying to import your wallet',
          type: 'error',
        });
      } finally {
        setProcessing(false);
      }
    }, 0);
  };

  const goToHome = () => {
    navigation.replace('TabBar', {
      screen: 'Home',
    });
  };

  return (
    <MainScreenLayout title="Enter your Recovery Passphrase" showBack>
      <KeyboardAvoidingView
        style={styles.mainContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollView}>
          <PWView style={styles.wordContainer}>
            {[0, 1].map(column => {
              const columnOffset = 12 * column;
              return (
                <PWView style={styles.column} key={`column-${columnOffset}`}>
                  {words
                    .slice(columnOffset, columnOffset + 12)
                    .map((word, index) => {
                      const offsetIndex = index + columnOffset;

                      return (
                        <PWView
                          style={styles.inputContainerRow}
                          key={`wordinput-${offsetIndex}`}
                        >
                          <Text
                            h4
                            h4Style={
                              focused === offsetIndex
                                ? styles.focusedLabel
                                : styles.label
                            }
                          >
                            {offsetIndex + 1}
                          </Text>
                          <Input
                            containerStyle={styles.inputOuterContainer}
                            inputContainerStyle={
                              focused === offsetIndex
                                ? styles.focusedInputContainer
                                : styles.inputContainer
                            }
                            inputStyle={styles.input}
                            renderErrorMessage={false}
                            value={word}
                            cursorColor={theme.colors.textMain}
                            onChangeText={event =>
                              updateWord(event, offsetIndex)
                            }
                            onFocus={() => setFocused(offsetIndex)}
                            autoFocus={column === 0 && index === 0}
                            autoCapitalize="none"
                            autoCorrect
                          />
                        </PWView>
                      );
                    })}
                </PWView>
              );
            })}
          </PWView>
          <PWButton
            style={styles.finishButton}
            variant="primary"
            title="Import Wallet"
            onPress={handleImportAccount}
            disabled={!canImport}
          />
        </ScrollView>
      </KeyboardAvoidingView>
      <Overlay
        isVisible={processing}
        overlayStyle={styles.overlay}
        backdropStyle={styles.overlayBackdrop}
      >
        <Text>Importing wallet...</Text>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </Overlay>
    </MainScreenLayout>
  );
};

export default ImportAccountScreen;
