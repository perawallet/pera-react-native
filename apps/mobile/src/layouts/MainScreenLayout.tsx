import { View, ViewProps } from 'react-native';
import { useStyles } from './MainScreenLayout.style';
import { Networks, useAppStore } from '@perawallet/core';
import { SafeAreaView } from 'react-native-safe-area-context';
import PeraView from '../components/common/view/PeraView';
import { useNavigation } from '@react-navigation/native';

import ChevronLeft from '../../assets/icons/chevron-left.svg';
import { Text, useTheme } from '@rneui/themed';

export type MainScreenLayoutProps = {
  fullScreen?: boolean
  showBack?: boolean
  title?: string
  header?: boolean
} & ViewProps;

const MainScreenLayout = (props: MainScreenLayoutProps) => {
  const styles = useStyles(props);
  const { theme } = useTheme();
  const network = useAppStore(state => state.network);
  const navigation = useNavigation();

  const goBack = () => {
    navigation.goBack();
  };

  return props.fullScreen || props.header ? (
    <PeraView style={[styles.mainContainer, props.style]} {...props}>
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
