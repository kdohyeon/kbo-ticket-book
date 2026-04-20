import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { signInAnonymously } from 'firebase/auth';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { auth } from '../../src/config/firebase';
import {
    signInWithApple,
    signInWithKakao,
    useGoogleAuth,
} from '../../src/hooks/useSocialAuth';

export default function LoginScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const { signInWithGoogle, loading: googleLoading } = useGoogleAuth();

    const isLoading = loading || googleLoading;

    const handleGoogle = async () => {
        const result = await signInWithGoogle();
        if (!result.success && result.error === 'failed') {
            Alert.alert('오류', 'Google 로그인에 실패했습니다.');
        }
    };

    const handleApple = async () => {
        setLoading(true);
        const result = await signInWithApple();
        setLoading(false);
        if (!result.success && result.error === 'failed') {
            Alert.alert('오류', 'Apple 로그인에 실패했습니다.');
        }
    };

    const handleKakao = async () => {
        setLoading(true);
        const result = await signInWithKakao();
        setLoading(false);
        if (!result.success && result.error === 'failed') {
            Alert.alert('오류', 'Kakao 로그인에 실패했습니다.');
        }
    };

    const handleGuest = async () => {
        setLoading(true);
        try {
            await signInAnonymously(auth);
        } catch {
            Alert.alert('오류', '게스트 로그인에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.inner}>
                <View style={styles.header}>
                    <Text style={styles.logo}>직관노트</Text>
                    <Text style={styles.subtitle}>KBO 직관 기록 앱</Text>
                </View>

                <View style={styles.buttons}>
                    {/* Google 로그인 */}
                    <Pressable
                        style={[styles.btn, styles.btnGoogle]}
                        onPress={handleGoogle}
                        disabled={isLoading}
                    >
                        <Text style={styles.btnIconGoogle}>G</Text>
                        <Text style={[styles.btnText, styles.btnTextDark]}>
                            Google로 계속하기
                        </Text>
                    </Pressable>

                    {/* Apple 로그인 (iOS 전용) */}
                    {Platform.OS === 'ios' && (
                        <AppleAuthentication.AppleAuthenticationButton
                            buttonType={
                                AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                            }
                            buttonStyle={
                                AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                            }
                            cornerRadius={12}
                            style={styles.btnApple}
                            onPress={handleApple}
                        />
                    )}

                    {/* Kakao 로그인 */}
                    <Pressable
                        style={[styles.btn, styles.btnKakao]}
                        onPress={handleKakao}
                        disabled={isLoading}
                    >
                        <Text style={styles.btnIconKakao}>K</Text>
                        <Text style={[styles.btnText, styles.btnTextDark]}>
                            카카오로 계속하기
                        </Text>
                    </Pressable>

                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>또는</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* 게스트 로그인 */}
                    <Pressable
                        style={[styles.btn, styles.btnGuest]}
                        onPress={handleGuest}
                        disabled={isLoading}
                    >
                        <Text style={[styles.btnText, styles.btnTextGray]}>
                            로그인 없이 시작하기
                        </Text>
                    </Pressable>
                </View>

                {isLoading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#2563EB" />
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    inner: {
        flex: 1,
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 48,
    },
    header: {
        alignItems: 'center',
        marginTop: 48,
    },
    logo: {
        fontSize: 40,
        fontWeight: '800',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
    },
    buttons: {
        gap: 12,
    },
    btn: {
        height: 52,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    btnApple: {
        height: 52,
        width: '100%',
    },
    btnGoogle: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    btnKakao: {
        backgroundColor: '#FEE500',
    },
    btnGuest: {
        backgroundColor: '#F5F5F7',
    },
    btnText: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
    },
    btnTextDark: {
        color: '#1a1a1a',
    },
    btnTextGray: {
        color: '#666',
    },
    btnIconGoogle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#4285F4',
        width: 24,
    },
    btnIconKakao: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1a1a1a',
        width: 24,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 4,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E5E5EA',
    },
    dividerText: {
        marginHorizontal: 12,
        color: '#999',
        fontSize: 14,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.7)',
    },
});
