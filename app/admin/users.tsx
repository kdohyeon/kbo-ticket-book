import { db } from '@/src/config/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface UserSummary {
    userId: string;
    recordCount: number;
    lastActivity: Date | null;
}

interface RecordDetail {
    date: string;
    matchup: string;
    result: string;
    stadium: string;
}

export default function UsersList() {
    const [users, setUsers] = useState<UserSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [userRecords, setUserRecords] = useState<RecordDetail[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        setIsError(false);
        try {
            const q = query(collection(db, 'records'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);

            const userMap = new Map<string, UserSummary>();
            snapshot.forEach(doc => {
                const data = doc.data();
                const uid: string = data.userId;
                if (!uid) return;

                const createdAt: Date | null = data.createdAt?.toDate?.() ?? null;

                if (!userMap.has(uid)) {
                    userMap.set(uid, { userId: uid, recordCount: 0, lastActivity: null });
                }
                const entry = userMap.get(uid)!;
                entry.recordCount += 1;
                if (createdAt && (!entry.lastActivity || createdAt > entry.lastActivity)) {
                    entry.lastActivity = createdAt;
                }
            });

            setUsers(Array.from(userMap.values()));
        } catch (e) {
            console.error(e);
            setIsError(true);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserRecords = async (userId: string) => {
        setDetailLoading(true);
        try {
            const q = query(collection(db, 'records'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            const records: RecordDetail[] = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.userId === userId) {
                    records.push({
                        date: data.date ?? '',
                        matchup: data.matchup ?? '',
                        result: data.result ?? '',
                        stadium: data.stadium ?? '',
                    });
                }
            });
            setUserRecords(records);
        } catch (e) {
            console.error(e);
            Alert.alert('오류', '기록을 불러오지 못했습니다.');
        } finally {
            setDetailLoading(false);
        }
    };

    const handleSelectUser = (userId: string) => {
        if (selectedUser === userId) {
            setSelectedUser(null);
            setUserRecords([]);
        } else {
            setSelectedUser(userId);
            fetchUserRecords(userId);
        }
    };

    const formatDate = (date: Date | null) => {
        if (!date) return '-';
        return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    const shortId = (uid: string) => `${uid.slice(0, 8)}...`;

    const resultColor = (result: string) => {
        if (result === 'WIN') return '#D32F2F';
        if (result === 'LOSE') return '#1976D2';
        if (result === 'DRAW') return '#757575';
        return '#bbb';
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (isError) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>유저 목록을 불러오지 못했습니다.</Text>
                <TouchableOpacity style={styles.retryButton} onPress={fetchUsers}>
                    <Text style={styles.retryButtonText}>다시 시도</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <Text style={styles.title}>사용자 관리</Text>
                <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{users.length}명</Text>
                </View>
            </View>

            <Text style={styles.notice}>
                * records 컬렉션 기반으로 집계된 유저 목록입니다. 행을 탭하면 해당 유저의 직관 기록을 확인할 수 있습니다.
            </Text>

            {/* 유저 테이블 */}
            <View style={styles.tableContainer}>
                <View style={styles.tableHeader}>
                    <Text style={[styles.th, { flex: 2 }]}>User ID</Text>
                    <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>기록 수</Text>
                    <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>최근 활동</Text>
                </View>

                {users.length === 0 ? (
                    <View style={styles.emptyRow}>
                        <Text style={styles.emptyText}>등록된 기록이 없습니다.</Text>
                    </View>
                ) : (
                    users.map(user => (
                        <React.Fragment key={user.userId}>
                            <TouchableOpacity
                                style={[styles.row, selectedUser === user.userId && styles.rowSelected]}
                                onPress={() => handleSelectUser(user.userId)}
                                activeOpacity={0.7}
                            >
                                <View style={{ flex: 2 }}>
                                    <Text style={styles.td}>{shortId(user.userId)}</Text>
                                </View>
                                <Text style={[styles.td, { flex: 1, textAlign: 'center', fontWeight: '700' }]}>
                                    {user.recordCount}
                                </Text>
                                <Text style={[styles.td, { flex: 1.5, textAlign: 'right', color: '#888' }]}>
                                    {formatDate(user.lastActivity)}
                                </Text>
                            </TouchableOpacity>

                            {/* 유저 기록 상세 (펼침) */}
                            {selectedUser === user.userId && (
                                <View style={styles.detailPanel}>
                                    {detailLoading ? (
                                        <ActivityIndicator size="small" style={{ margin: 16 }} />
                                    ) : userRecords.length === 0 ? (
                                        <Text style={styles.emptyText}>기록 없음</Text>
                                    ) : (
                                        userRecords.map((rec, i) => (
                                            <View key={i} style={styles.recordRow}>
                                                <Text style={styles.recordDate}>{rec.date}</Text>
                                                <Text style={styles.recordMatchup} numberOfLines={1}>{rec.matchup}</Text>
                                                <View style={[styles.resultBadge, { backgroundColor: resultColor(rec.result) }]}>
                                                    <Text style={styles.resultText}>
                                                        {rec.result === 'SCHEDULED' ? '예정' : rec.result}
                                                    </Text>
                                                </View>
                                            </View>
                                        ))
                                    )}
                                </View>
                            )}
                        </React.Fragment>
                    ))
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    countBadge: {
        backgroundColor: '#000',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    countBadgeText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 13,
    },
    notice: {
        fontSize: 12,
        color: '#aaa',
        marginBottom: 20,
        lineHeight: 18,
    },
    tableContainer: {
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 8,
        overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f0f0f0',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    th: {
        fontWeight: '700',
        color: '#333',
        fontSize: 13,
    },
    row: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        alignItems: 'center',
    },
    rowSelected: {
        backgroundColor: '#f5f5f5',
    },
    td: {
        fontSize: 14,
        color: '#333',
    },
    detailPanel: {
        backgroundColor: '#fafafa',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 6,
    },
    recordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 4,
    },
    recordDate: {
        fontSize: 12,
        color: '#888',
        width: 90,
    },
    recordMatchup: {
        fontSize: 13,
        color: '#333',
        flex: 1,
    },
    resultBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    resultText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
    emptyRow: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#999',
        fontSize: 14,
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
});
