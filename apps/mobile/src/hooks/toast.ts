import { makeStyles } from '@rneui/themed';
import { useCallback } from 'react';
import { Notifier } from 'react-native-notifier';

export interface ToastMessage {
  title: string;
  body: string;
  type: 'error' | 'warning' | 'info' | 'success';
}

const useStyles = makeStyles(theme => {
  return {
    baseStyle: {
      zIndex: 10000,
      marginTop: theme.spacing.xl,
      borderWidth: 0,
    },
    successStyle: {
      backgroundColor: theme.colors.success,
    },
    successStyleText: {
      color: theme.colors.white,
    },
    errorStyle: {
      backgroundColor: theme.colors.error,
    },
    errorStyleText: {
      color: theme.colors.white,
    },
    infoStyle: {
      backgroundColor: theme.colors.background,
    },
    infoStyleText: {
      color: theme.colors.textMain,
    },
    warningStyle: {
      backgroundColor: theme.colors.error,
    },
    warningStyleText: {
      color: theme.colors.white,
    },
  };
});

const useToast = () => {
  const styles = useStyles();

  const showToast = useCallback(
    (message: ToastMessage) => {
      let containerStyle = styles.infoStyle;
      let textStyle = styles.infoStyleText;
      if (message.type === 'error') {
        containerStyle = styles.errorStyle;
        textStyle = styles.errorStyleText;
      } else if (message.type === 'warning') {
        containerStyle = styles.warningStyle;
        textStyle = styles.warningStyleText;
      } else if (message.type === 'success') {
        containerStyle = styles.successStyle;
        textStyle = styles.successStyleText;
      }

      Notifier.showNotification({
        title: message.title,
        description: message.body,
        componentProps: {
          containerStyle: [styles.baseStyle, containerStyle],
          titleStyle: textStyle,
          descriptionStyle: textStyle,
        },
      });
    },
    [styles],
  );

  return {
    showToast,
  };
};

export default useToast;
