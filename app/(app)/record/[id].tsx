import { IconSymbol } from '@/components/ui/icon-symbol';
import { TEAMS } from '@/constants/teams';
import { useTheme } from '@/context/ThemeContext';
import { db } from '@/src/config/firebase';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface TicketRecord {
    id: string;
    date: string;
    day: string;
    matchup: string;
    result: 'WIN' | 'LOSE' | 'DRAW' | 'SCHEDULED';
    score: string;
    stadium: string;
    seat: string;
    userId: string;
    myTeamSide?: 'HOME' | 'AWAY'; // Allow undefined for legacy records
}

export default function TicketDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const navigation = useNavigation();
    const { selectedTeam } = useTheme();

    const [ticket, setTicket] = useState<TicketRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Edited State
    const [editedSeat, setEditedSeat] = useState('');
    const [editedSide, setEditedSide] = useState<'HOME' | 'AWAY' | undefined>(undefined);

    const [saving, setSaving] = useState(false);

    const primaryColor = selectedTeam?.primaryColor || '#F37321';

    useEffect(() => {
        fetchTicket();
    }, [id]);

    const fetchTicket = async () => {
        if (!id || typeof id !== 'string') {
            setIsError(true);
            setLoading(false);
            return;
        }
        setLoading(true);
        setIsError(false);
        try {
            const docRef = doc(db, 'records', id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data() as Omit<TicketRecord, 'id'>;
                setTicket({ id: docSnap.id, ...data });
                setEditedSeat(data.seat);
                setEditedSide(data.myTeamSide || 'HOME');
            } else {
                Alert.alert('오류', '기록을 찾을 수 없습니다.', [
                    { text: '확인', onPress: () => router.back() },
                ]);
            }
        } catch (error) {
            console.error(error);
            setIsError(true);
        } finally {
            setLoading(false);
        }
    };

    const normalizeResult = (res: string) => {
        if (['WIN', 'LOSE', 'DRAW', 'SCHEDULED'].includes(res)) return res as 'WIN' | 'LOSE' | 'DRAW' | 'SCHEDULED';
        return 'SCHEDULED'; // Fallback
    };

    const recalculateResult = (side: 'HOME' | 'AWAY', currentScore: string, currentResult: TicketRecord['result']): TicketRecord['result'] => {
        // If originally scheduled match (no score), keep it scheduled or VS
        if (currentResult === 'SCHEDULED' && (!currentScore || currentScore === '')) return 'SCHEDULED';

        const parts = currentScore.split(':');
        if (parts.length !== 2) return currentResult; // Can't parse score, keep existing

        const awayScore = parseInt(parts[0]);
        const homeScore = parseInt(parts[1]);

        if (isNaN(awayScore) || isNaN(homeScore)) return currentResult;

        const myScore = side === 'HOME' ? homeScore : awayScore;
        const opScore = side === 'HOME' ? awayScore : homeScore;

        if (myScore > opScore) return 'WIN';
        if (myScore < opScore) return 'LOSE';
        return 'DRAW';
    };

    const handleSave = async () => {
        if (!ticket || !id || typeof id !== 'string') return;
        setSaving(true);
        try {
            const docRef = doc(db, 'records', id);

            // Recalculate result based on new side if changed
            let newResult = ticket.result;
            if (editedSide && editedSide !== ticket.myTeamSide) {
                newResult = recalculateResult(editedSide, ticket.score, ticket.result);
            }

            // Always update fields
            await updateDoc(docRef, {
                seat: editedSeat,
                myTeamSide: editedSide,
                result: newResult
            });

            setTicket({
                ...ticket,
                seat: editedSeat,
                myTeamSide: editedSide,
                result: newResult
            });
            setIsEditing(false);
            Alert.alert('성공', '수정이 완료되었습니다.');
        } catch (error) {
            console.error(error);
            Alert.alert('오류', '수정에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        if (!ticket || !id || typeof id !== 'string') return;
        Alert.alert('기록 삭제', `'${ticket.matchup}' 기록을 정말 삭제하시겠습니까?`, [
            { text: '취소', style: 'cancel' },
            {
                text: '삭제',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteDoc(doc(db, 'records', id));
                        Alert.alert('삭제 완료', '기록이 삭제되었습니다.', [
                            { text: '확인', onPress: () => router.back() }
                        ]);
                    } catch (error) {
                        console.error('Delete error:', error);
                        Alert.alert('오류', '삭제 중 문제가 발생했습니다.');
                    }
                },
            },
        ]);
    }

    // Helper to parse Home/Away from matchup "Away vs Home"
    const getTeams = (matchup: string) => {
        const parts = matchup.split(' vs ');
        if (parts.length === 2) {
            return { away: parts[0], home: parts[1] };
        }
        return { away: 'Away', home: 'Home' };
    }

    // Helper to parse score "Away : Home"
    const getScores = (score: string) => {
        const parts = score.split(':');
        if (parts.length === 2) {
            return { away: parts[0], home: parts[1] };
        }
        return { away: '0', home: '0' };
    }

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={primaryColor} />
            </View>
        );
    }

    if (isError || !ticket) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <IconSymbol name="chevron.left" size={28} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>상세 기록</Text>
                    <View style={{ width: 28 }} />
                </View>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>기록을 불러오지 못했습니다.</Text>
                    <TouchableOpacity style={[styles.retryButton, { borderColor: primaryColor }]} onPress={fetchTicket}>
                        <Text style={[styles.retryButtonText, { color: primaryColor }]}>다시 시도</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text style={styles.backText}>돌아가기</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const { away: awayName, home: homeName } = getTeams(ticket.matchup);
    const { away: awayScore, home: homeScore } = getScores(ticket.score);

    const homeTeamInfo = TEAMS.find(t => t.name === homeName);
    const awayTeamInfo = TEAMS.find(t => t.name === awayName);

    // Current display side (use edited if editing)
    const currentSide = isEditing ? editedSide : ticket.myTeamSide;
    // Fallback if myTeamSide not known: Default Home
    const isAwayMyTeam = currentSide === 'AWAY';
    const isHomeMyTeam = currentSide === 'HOME' || (!currentSide && !isAwayMyTeam);

    const resultColor =
        ticket.result === 'WIN' ? '#D32F2F'
            : ticket.result === 'LOSE' ? '#1976D2'
                : ticket.result === 'SCHEDULED' ? '#BBBBBB'
                    : '#757575';

    const resultText = ticket.result === 'SCHEDULED' ? '예정' : ticket.result;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <IconSymbol name="chevron.left" size={28} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>상세 기록</Text>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                    <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
                        <IconSymbol name={isEditing ? "xmark.circle" : "pencil"} size={24} color={primaryColor} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleDelete}>
                        <IconSymbol name="trash" size={24} color="#FF3B30" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/** Scoreboard Card */}
                <View style={[styles.scoreCard, isEditing && styles.editScoreCard]}>
                    <Text style={styles.dateText}>{ticket.date}</Text>
                    <Text style={styles.stadiumText}>{ticket.stadium}</Text>

                    {isEditing && (
                        <Text style={{ color: primaryColor, fontWeight: 'bold', marginBottom: 12 }}>
                            응원했던 팀을 선택해주세요
                        </Text>
                    )}

                    <View style={styles.matchupContainer}>
                        {/** AWAY Team */}
                        <TouchableOpacity
                            style={[
                                styles.teamColumn,
                                isAwayMyTeam && isEditing && { opacity: 1 },
                                !isAwayMyTeam && isEditing && { opacity: 0.5 }
                            ]}
                            disabled={!isEditing}
                            onPress={() => setEditedSide('AWAY')}
                        >
                            <View style={[styles.logoPlaceholder, isAwayMyTeam && { borderWidth: 2, borderColor: primaryColor }]}>
                                {awayTeamInfo?.image ? (
                                    <Image source={awayTeamInfo.image} style={styles.teamLogo} resizeMode="contain" />
                                ) : (
                                    <Text style={styles.teamInitial}>{awayName.charAt(0)}</Text>
                                )}
                                {isAwayMyTeam && (
                                    <View style={[styles.checkBadge, { backgroundColor: primaryColor }]}>
                                        <IconSymbol name="checkmark" size={10} color="#fff" />
                                    </View>
                                )}
                            </View>
                            <Text style={[styles.teamName, isAwayMyTeam && { color: primaryColor }]}>{awayName}</Text>
                        </TouchableOpacity>

                        <View style={styles.scoreColumn}>
                            <Text style={styles.scoreDisplay}>
                                {ticket.result === 'SCHEDULED' ? 'VS' : `${awayScore} : ${homeScore}`}
                            </Text>
                            <View style={[styles.resultBadge, { backgroundColor: resultColor }]}>
                                <Text style={styles.resultText}>{resultText}</Text>
                            </View>
                        </View>

                        {/** HOME Team */}
                        <TouchableOpacity
                            style={[
                                styles.teamColumn,
                                isHomeMyTeam && isEditing && { opacity: 1 },
                                !isHomeMyTeam && isEditing && { opacity: 0.5 }
                            ]}
                            disabled={!isEditing}
                            onPress={() => setEditedSide('HOME')}
                        >
                            <View style={[styles.logoPlaceholder, isHomeMyTeam && { borderWidth: 2, borderColor: primaryColor }]}>
                                {homeTeamInfo?.image ? (
                                    <Image source={homeTeamInfo.image} style={styles.teamLogo} resizeMode="contain" />
                                ) : (
                                    <Text style={styles.teamInitial}>{homeName.charAt(0)}</Text>
                                )}
                                {isHomeMyTeam && (
                                    <View style={[styles.checkBadge, { backgroundColor: primaryColor }]}>
                                        <IconSymbol name="checkmark" size={10} color="#fff" />
                                    </View>
                                )}
                            </View>
                            <Text style={[styles.teamName, isHomeMyTeam && { color: primaryColor }]}>{homeName}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/** Seat Info Section */}
                <View style={styles.infoSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>좌석 정보</Text>
                    </View>

                    {isEditing ? (
                        <View style={styles.editContainer}>
                            <TextInput
                                style={[styles.input, { borderColor: primaryColor }]}
                                value={editedSeat}
                                placeholder="좌석 정보 입력"
                                onChangeText={setEditedSeat}
                                autoFocus
                            />
                            <View style={styles.editActions}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={() => {
                                        setEditedSeat(ticket.seat);
                                        setEditedSide(ticket.myTeamSide || 'HOME');
                                        setIsEditing(false);
                                    }}
                                >
                                    <Text style={styles.cancelButtonText}>취소</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.saveButton, { backgroundColor: primaryColor }]}
                                    onPress={handleSave}
                                    disabled={saving}
                                >
                                    <Text style={styles.saveButtonText}>{saving ? '저장 중...' : '저장'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <Text style={styles.seatText}>{ticket.seat || '좌석 정보 없음'}</Text>
                    )}
                </View>


            </ScrollView>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorContainer: {
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
    },
    retryButtonText: {
        fontSize: 15,
        fontWeight: '600',
    },
    backText: {
        fontSize: 14,
        color: '#999',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    scrollContent: {
        padding: 20,
    },
    scoreCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    editScoreCard: {
        borderWidth: 2,
        borderColor: '#eee',
        borderStyle: 'dashed',
    },
    dateText: {
        fontSize: 16,
        color: '#666',
        marginBottom: 4,
        fontWeight: '600',
    },
    stadiumText: {
        fontSize: 14,
        color: '#888',
        marginBottom: 24,
    },
    matchupContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        width: '100%',
    },
    teamColumn: {
        flex: 1,
        alignItems: 'center',
    },
    logoPlaceholder: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        overflow: 'visible', // allow badge
        position: 'relative',
    },
    teamLogo: {
        width: '80%',
        height: '80%',
    },
    teamInitial: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#aaa',
    },
    checkBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    teamName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#333',
        textAlign: 'center',
    },
    scoreColumn: {
        width: 100,
        alignItems: 'center',
        paddingTop: 10,
    },
    scoreDisplay: {
        fontSize: 32,
        fontWeight: '900',
        color: '#000',
        marginBottom: 8,
    },
    resultBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    resultText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    infoSection: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    editButton: {
        fontSize: 14,
        fontWeight: '600',
    },
    seatText: {
        fontSize: 18,
        color: '#333',
    },
    editContainer: {
        gap: 12,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
    },
    editActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
    },
    cancelButton: {
        padding: 10,
    },
    cancelButtonText: {
        color: '#666',
        fontWeight: '600',
    },
    saveButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});


