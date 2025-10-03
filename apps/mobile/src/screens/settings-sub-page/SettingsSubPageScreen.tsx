import { Button, Text } from '@rneui/themed';
import MainScreenLayout from '../../layouts/MainScreenLayout';

import { StaticScreenProps } from '@react-navigation/native';
import { useAppStore } from '@perawallet/core';
import { useQueryClient } from '@tanstack/react-query';
import { useStyles } from './styles';
import PeraView from '../../components/common/view/PeraView';

type SettingsSubPageScreenProps = StaticScreenProps<{
  title: string;
}>;

const SettingsSubPageScreen = ({ route }: SettingsSubPageScreenProps) => {
    const styles = useStyles()
  const setTheme = useAppStore(state => state.setTheme)
  const theme = useAppStore(state => state.theme)
  const network = useAppStore(state => state.network)
  const setNetwork = useAppStore(state => state.setNetwork)
  const queryClient = useQueryClient()

  const toggleTheme = () => {
    if (theme === 'dark' || theme === 'system') {
        setTheme('light')
    } else {
        setTheme('dark')
    }
  }

  const toggleNetwork = () => {
    if (network === 'mainnet') {
        setNetwork('testnet')
    } else {
        setNetwork('mainnet')
    }

    queryClient.invalidateQueries()
  }

  return (
    <MainScreenLayout>
        <PeraView style={styles.container}>
            <Text>This page would hold the settings for {route.params.title}.  
                For now we are going to just put some random stuff here for ease of use
            </Text>

            <Button onPress={toggleTheme} title="Toggle Theme" />

            <Button onPress={toggleNetwork} title="Toggle Network" />
        </PeraView>
    </MainScreenLayout>
  );
};

export default SettingsSubPageScreen;
