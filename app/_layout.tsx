import 'react-native-gesture-handler';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeProvider as CustomThemeProvider } from '@/lib/theme-provider';
import { GameProvider } from '@/lib/game-context';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <CustomThemeProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <GameProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="game-rules"
              options={{
                headerShown: false,
                presentation: 'card',
              }}
            />
            <Stack.Screen
              name="game-result"
              options={{
                headerShown: false,
                presentation: 'card',
              }}
            />
            <Stack.Screen
              name="rankings"
              options={{
                headerShown: false,
                presentation: 'card',
              }}
            />
            <Stack.Screen
              name="training-mode"
              options={{
                headerShown: false,
                presentation: 'card',
              }}
            />
          </Stack>
        </GameProvider>
      </ThemeProvider>
    </CustomThemeProvider>
  );
}
