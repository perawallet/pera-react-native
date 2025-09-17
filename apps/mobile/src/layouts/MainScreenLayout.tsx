import { View, ViewProps } from 'react-native';
import { useStyles } from './MainScreenLayout.style';
import { Networks, useAppStore, useDevice } from '@perawallet/core';
import { SafeAreaView } from 'react-native-safe-area-context';
import PeraView from '../components/view/PeraView';
import { useNavigation } from '@react-navigation/native';

import ChevronLeft from '../../assets/icons/chevron-left.svg';
import { Text, useTheme } from '@rneui/themed';
import { useEffect } from 'react';

export type MainScreenLayoutProps = {
  fullScreen?: boolean;
  showBack?: boolean;
  title?: string;
} & ViewProps;

const MainScreenLayout = (props: MainScreenLayoutProps) => {
  const styles = useStyles();
  const { theme } = useTheme();
  const network = useAppStore(state => state.network);
  const navigation = useNavigation();
  const { registerDevice } = useDevice();

  const goBack = () => {
    navigation.goBack();
  };

  useEffect(() => {
    registerDevice();
  }, [])

  return props.fullScreen ? (
    <PeraView style={[props.style, styles.mainContainer]} {...props}>
      {props.showBack && (
        <ChevronLeft
          stroke={theme.colors.textMain}
          onPress={goBack}
          style={styles.backContainer}
        />
      )}
      {props.title && (
        <Text h1 style={styles.title}>
          {props.title}
        </Text>
      )}
      {network === Networks.testnet && <View style={styles.testnetContainer} />}

      {props.children}
    </PeraView>
  ) : (
    <SafeAreaView style={[props.style, styles.mainContainer]} {...props}>
      {props.showBack && (
        <ChevronLeft
          stroke={theme.colors.textMain}
          onPress={goBack}
          style={styles.backContainer}
        />
      )}
      {props.title && (
        <Text h1 style={styles.title}>
          {props.title}
        </Text>
      )}
      {network === Networks.testnet && <View style={styles.testnetContainer} />}

      {props.children}
    </SafeAreaView>
  );
};

export default MainScreenLayout;
