import { makeStyles } from '@rneui/themed';
import { MainScreenLayoutProps } from './MainScreenLayout';

export const useStyles = makeStyles((theme, props: MainScreenLayoutProps) => {
  return {
    mainContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: props.fullScreen ? 0 : theme.spacing.xl,
    },
    testnetContainer: {
      backgroundColor: theme.colors.primary,
      height: theme.spacing.lg * 2,
    },
    backContainer: {
      paddingVertical: theme.spacing.sm,
    },
    title: {
      marginVertical: theme.spacing.lg,
    },
  };
});
