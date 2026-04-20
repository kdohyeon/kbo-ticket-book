import { TEAMS } from '@/constants/teams';
import { db } from '@/src/config/firebase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const STADIUMS = [
    '잠실 야구장',
    '고척 스카이돔',
    '인천 SSG 랜더스필드',
    '수원 KT 위즈 파크',
    '한화생명 이글스파크',
    '대구 삼성 라이온즈 파크',
    '사직 야구장',
    '창원 NC 파크',
    '광주-기아 챔피언스 필드'
];

const GAME_TIMES = ['14:00', '17:00', '18:30'];

export default function GameForm() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const isNew = id === 'new';

    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(!isNew);
    const [isError, setIsError] = useState(false);

    const [date, setDate] = useState('');     // YYYY-MM-DD
    const [time, setTime] = useState('18:30');
    const [homeTeamId, setHomeTeamId] = useState('');
    const [awayTeamId, setAwayTeamId] = useState('');
    const [stadium, setStadium] = useState('');
    const [homeScore, setHomeScore] = useState('');
    const [awayScore, setAwayScore] = useState('');
    const [status] = useState('scheduled'); // Default

    useEffect(() => {
        if (!isNew && id) {
            fetchGame(id as string);
        }
    }, [id]);

    const fetchGame = async (gameId: string) => {
        setIsError(false);
        try {
            const docRef = doc(db, 'games', gameId);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data();
                setDate(data.date);
                setTime(data.time);
                setHomeTeamId(data.homeTeamId);
                setAwayTeamId(data.awayTeamId);
                setStadium(data.stadium);
                if (data.homeScore !== undefined) setHomeScore(data.homeScore.toString());
                if (data.awayScore !== undefined) setAwayScore(data.awayScore.toString());
            } else {
                Alert.alert('오류', '경기를 찾을 수 없습니다.', [
                    { text: '확인', onPress: () => router.back() },
                ]);
            }
        } catch (e) {
            console.error(e);
            setIsError(true);
        } finally {
            setInitialLoading(false);
        }
    };

    const handleSave = async () => {
        if (!date || !time || !homeTeamId || !awayTeamId || !stadium) {
            Alert.alert('오류', '모든 필수 항목을 입력해주세요.');
            return;
        }

        // Basic Date Validation
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            Alert.alert('오류', '날짜 형식은 YYYY-MM-DD 여야 합니다.');
            return;
        }

        setLoading(true);
        try {
            const data: any = {
                date,
                time,
                homeTeamId,
                awayTeamId,
                stadium,
                status
            };

            // Process scores if entered
            if (homeScore !== '') data.homeScore = parseInt(homeScore);
            if (awayScore !== '') data.awayScore = parseInt(awayScore);

            // Update status if scores exist
            if (homeScore !== '' && awayScore !== '') {
                data.status = 'finished';
            }

            if (isNew) {
                await addDoc(collection(db, 'games'), data);
                if (Platform.OS === 'web') {
                    window.alert('경기가 추가되었습니다.');
                } else {
                    Alert.alert('성공', '경기가 추가되었습니다.');
                }
            } else {
                await updateDoc(doc(db, 'games', id as string), data);
                if (Platform.OS === 'web') {
                    window.alert('경기가 수정되었습니다.');
                } else {
                    Alert.alert('성공', '경기가 수정되었습니다.');
                }
            }
            router.back();
        } catch (e) {
            console.error(e);
            if (Platform.OS === 'web') {
                window.alert('저장 실패: ' + (e as any).message);
            } else {
                Alert.alert('오류', '저장 실패');
            }
        } finally {
            setLoading(false);
        }
    };

    // Auto-fill stadium when Home Team is selected
    useEffect(() => {
        if (homeTeamId && isNew) { // Only auto-fill if new or user didn't manually set? Let's just do it for simple UX
            switch (homeTeamId) {
                case 'lg': case 'doosan': setStadium('잠실 야구장'); break;
                case 'kiwoom': setStadium('고척 스카이돔'); break;
                case 'ssg': setStadium('인천 SSG 랜더스필드'); break;
                case 'kt': setStadium('수원 KT 위즈 파크'); break;
                case 'hanwha': setStadium('한화생명 이글스파크'); break;
                case 'samsung': setStadium('대구 삼성 라이온즈 파크'); break;
                case 'lotte': setStadium('사직 야구장'); break;
                case 'nc': setStadium('창원 NC 파크'); break;
                case 'kia': setStadium('광주-기아 챔피언스 필드'); break;
            }
        }
    }, [homeTeamId]);

    if (initialLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (isError) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.errorText}>데이터를 불러오지 못했습니다.</Text>
                <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => { setInitialLoading(true); fetchGame(id as string); }}
                >
                    <Text style={styles.retryButtonText}>다시 시도</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.title}>{isNew ? '경기 추가' : '경기 수정'}</Text>

            <View style={styles.formGroup}>
                <Text style={styles.label}>날짜</Text>
                {Platform.OS === 'web' ? (
                    <View style={styles.webInputContainer}>
                        {/* @ts-ignore */}
                        {React.createElement('input', {
                            type: 'date',
                            value: date,
                            onChange: (e: any) => setDate(e.target.value),
                            style: {
                                padding: 12,
                                fontSize: 16,
                                border: '1px solid #ddd',
                                borderRadius: 8,
                                width: '100%',
                                boxSizing: 'border-box',
                                fontFamily: 'system-ui',
                                height: 50 // Match other inputs
                            }
                        })}
                    </View>
                ) : (
                    <TextInput
                        style={styles.input}
                        value={date}
                        onChangeText={setDate}
                        placeholder="2024-04-01 (YYYY-MM-DD)"
                    />
                )}
            </View>

            <View style={styles.formGroup}>
                <Text style={styles.label}>시간</Text>
                <View style={styles.timeContainer}>
                    {GAME_TIMES.map((t) => (
                        <TouchableOpacity
                            key={t}
                            style={[styles.timeChip, time === t && styles.timeChipActive]}
                            onPress={() => setTime(t)}
                        >
                            <Text style={[styles.timeText, time === t && styles.timeTextActive]}>{t}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.formGroup}>
                <Text style={styles.label}>홈 팀</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {TEAMS.map(team => (
                        <TouchableOpacity
                            key={team.id}
                            style={[styles.chip, homeTeamId === team.id && styles.chipActive]}
                            onPress={() => setHomeTeamId(team.id)}
                        >
                            <Text style={[styles.chipText, homeTeamId === team.id && styles.chipTextActive]}>{team.name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.formGroup}>
                <Text style={styles.label}>원정 팀</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {TEAMS.map(team => (
                        <TouchableOpacity
                            key={team.id}
                            style={[styles.chip, awayTeamId === team.id && styles.chipActive]}
                            onPress={() => setAwayTeamId(team.id)}
                        >
                            <Text style={[styles.chipText, awayTeamId === team.id && styles.chipTextActive]}>{team.name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.formGroup}>
                <Text style={styles.label}>점수 (선택)</Text>
                <View style={styles.scoreContainer}>
                    <View style={styles.scoreInputGroup}>
                        <Text style={styles.subLabel}>원정</Text>
                        <TextInput
                            style={styles.scoreInput}
                            value={awayScore}
                            onChangeText={setAwayScore}
                            placeholder="0"
                            keyboardType="number-pad"
                        />
                    </View>
                    <Text style={styles.vs}>:</Text>
                    <View style={styles.scoreInputGroup}>
                        <Text style={styles.subLabel}>홈</Text>
                        <TextInput
                            style={styles.scoreInput}
                            value={homeScore}
                            onChangeText={setHomeScore}
                            placeholder="0"
                            keyboardType="number-pad"
                        />
                    </View>
                </View>
            </View>

            <View style={styles.formGroup}>
                <Text style={styles.label}>경기장</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {STADIUMS.map(s => (
                        <TouchableOpacity
                            key={s}
                            style={[styles.chip, stadium === s && styles.chipActive]}
                            onPress={() => setStadium(s)}
                        >
                            <Text style={[styles.chipText, stadium === s && styles.chipTextActive]}>{s}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                disabled={loading}
            >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>저장</Text>}
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#fff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    errorText: {
        fontSize: 16,
        color: '#666',
    },
    retryButton: {
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#007AFF',
    },
    retryButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#007AFF',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 30,
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        fontWeight: '600',
        marginBottom: 8,
        color: '#666',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
    },
    webInputContainer: {
        width: '100%',
    },
    chipScroll: {
        flexDirection: 'row',
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#f5f5f5',
        borderRadius: 20,
        marginRight: 8,
    },
    chipActive: {
        backgroundColor: '#000',
    },
    chipText: {
        fontSize: 14,
        color: '#333',
    },
    chipTextActive: {
        color: '#fff',
    },
    timeContainer: {
        flexDirection: 'row',
        gap: 10,
    },
    timeChip: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    timeChipActive: {
        backgroundColor: '#000',
        borderColor: '#000',
    },
    timeText: {
        fontSize: 16,
        color: '#666',
    },
    timeTextActive: {
        color: '#fff',
        fontWeight: 'bold',
    },
    scoreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    scoreInputGroup: {
        alignItems: 'center',
    },
    scoreInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 18,
        width: 80,
        textAlign: 'center',
    },
    subLabel: {
        marginBottom: 4,
        fontSize: 12,
        color: '#999',
    },
    vs: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#ddd',
        marginTop: 16,
    },
    saveButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 40,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    }
});
