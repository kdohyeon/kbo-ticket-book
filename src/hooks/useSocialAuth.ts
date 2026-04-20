import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import {
    GoogleAuthProvider,
    OAuthProvider,
    signInWithCredential,
} from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { auth } from '../config/firebase';

WebBrowser.maybeCompleteAuthSession();

export type SocialAuthError = 'cancelled' | 'failed' | 'unsupported';

interface SocialAuthResult {
    success: boolean;
    error?: SocialAuthError;
}

export function useGoogleAuth() {
    const [loading, setLoading] = useState(false);

    const [, response, promptAsync] = Google.useAuthRequest({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    });

    useEffect(() => {
        if (response?.type === 'success') {
            const { id_token } = response.params;
            const credential = GoogleAuthProvider.credential(id_token);
            signInWithCredential(auth, credential)
                .catch(console.error)
                .finally(() => setLoading(false));
        } else if (response?.type === 'error' || response?.type === 'dismiss') {
            setLoading(false);
        }
    }, [response]);

    const signInWithGoogle = async (): Promise<SocialAuthResult> => {
        setLoading(true);
        try {
            const result = await promptAsync();
            if (result.type === 'cancel' || result.type === 'dismiss') {
                setLoading(false);
                return { success: false, error: 'cancelled' };
            }
            return { success: true };
        } catch {
            setLoading(false);
            return { success: false, error: 'failed' };
        }
    };

    return { signInWithGoogle, loading };
}

export async function signInWithApple(): Promise<SocialAuthResult> {
    if (Platform.OS !== 'ios') {
        return { success: false, error: 'unsupported' };
    }

    try {
        const nonce = Crypto.randomUUID();
        const hashedNonce = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            nonce
        );

        const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
            nonce: hashedNonce,
        });

        if (!credential.identityToken) {
            return { success: false, error: 'failed' };
        }

        const provider = new OAuthProvider('apple.com');
        const authCredential = provider.credential({
            idToken: credential.identityToken,
            rawNonce: nonce,
        });

        await signInWithCredential(auth, authCredential);
        return { success: true };
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
            return { success: false, error: 'cancelled' };
        }
        return { success: false, error: 'failed' };
    }
}

export async function signInWithKakao(): Promise<SocialAuthResult> {
    const restApiKey = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;
    const customTokenEndpoint = process.env.EXPO_PUBLIC_KAKAO_CUSTOM_TOKEN_ENDPOINT;

    if (!restApiKey) {
        console.warn('EXPO_PUBLIC_KAKAO_REST_API_KEY is not set');
        return { success: false, error: 'failed' };
    }

    try {
        const redirectUri = AuthSession.makeRedirectUri({ scheme: 'kbo-ticket-book' });
        const authUrl =
            `https://kauth.kakao.com/oauth/authorize` +
            `?client_id=${restApiKey}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&response_type=code`;

        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

        if (result.type !== 'success') {
            return { success: false, error: 'cancelled' };
        }

        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        if (!code) {
            return { success: false, error: 'failed' };
        }

        // Kakao → Firebase: 백엔드 엔드포인트에서 커스텀 토큰 발급
        // EXPO_PUBLIC_KAKAO_CUSTOM_TOKEN_ENDPOINT 환경 변수로 URL 설정
        if (!customTokenEndpoint) {
            console.warn(
                'EXPO_PUBLIC_KAKAO_CUSTOM_TOKEN_ENDPOINT is not set. ' +
                'Kakao 로그인을 완료하려면 Firebase Cloud Function이 필요합니다.'
            );
            return { success: false, error: 'failed' };
        }

        const tokenResponse = await fetch(customTokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, redirectUri }),
        });

        if (!tokenResponse.ok) {
            return { success: false, error: 'failed' };
        }

        const { firebaseToken } = await tokenResponse.json();
        const { signInWithCustomToken } = await import('firebase/auth');
        await signInWithCustomToken(auth, firebaseToken);

        return { success: true };
    } catch {
        return { success: false, error: 'failed' };
    }
}
