import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { auth } from '@/src/config/firebase';
import { User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { FilterProvider } from '../../context/FilterContext';
import { ThemeProvider as TeamThemeProvider, useTheme } from '../../context/ThemeContext';

export const unstable_settings = {
    anchor: '(tabs)',
};

function AppLayoutNav() {
    const colorScheme = useColorScheme();
    const [authInitializing, setAuthInitializing] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const { selectedTeam, isLoading: themeLoading } = useTheme();
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
            setUser(firebaseUser);
            setAuthInitializing(false);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (authInitializing || themeLoading) return;

        const segs = segments as string[];
        const isLoginRoute = segs.includes('login');
        const isOnboardingRoute = segs.includes('onboarding');

        if (!user) {
            if (!isLoginRoute) router.replace('/(app)/login');
            return;
        }

        if (!selectedTeam && !isOnboardingRoute) {
            router.replace('/(app)/onboarding');
        } else if (selectedTeam && isOnboardingRoute) {
            router.replace('/(app)/(tabs)');
        } else if (selectedTeam && isLoginRoute) {
            router.replace('/(app)/(tabs)');
        }
    }, [authInitializing, themeLoading, user, selectedTeam, segments]);

    if (authInitializing || themeLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#0000ff" />
            </View>
        );
    }

    return (
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
                <Stack.Screen name="record/[id]" options={{ presentation: 'card', title: '상세 기록' }} />
                <Stack.Screen name="settings" options={{ title: '설정', headerBackTitle: '뒤로' }} />
            </Stack>
            <StatusBar style="auto" />
        </ThemeProvider>
    );
}

export default function AppLayout() {
    return (
        <TeamThemeProvider>
            <FilterProvider>
                <AppLayoutNav />
            </FilterProvider>
        </TeamThemeProvider>
    );
}
