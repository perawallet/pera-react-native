import { makeStyles } from '@rneui/themed';
import { MainScreenLayoutProps } from './MainScreenLayout';

export const useStyles = makeStyles((theme, props: MainScreenLayoutProps) => {
  return {
    mainContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: props.fullScreen ? 0 : theme.spacing.xl,
      paddingTop: props.fullScreen || props.header ? 0 : theme.spacing.xl,
      paddingBottom: props.fullScreen ? 0 : theme.spacing.xl,
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
