import { Stack } from 'expo-router';
import { COLORS, FONTS } from '@/lib/theme';

export default function ToolsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.cyan,
        headerTitleStyle: { fontFamily: FONTS.label, fontSize: 14 },
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Learning Tools' }} />
    </Stack>
  );
}
