import { TEAMS } from '@/constants/teams';
import { db } from '@/src/config/firebase';
import { useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDocs, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Game {
    id: string;
    date: string;
    time: string;
    homeTeamId: string;
    awayTeamId: string;
    stadium: string;
}

export default function GamesList() {
    const router = useRouter();
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());

    const years = ['2024', '2025', '2026'];
    const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString());

    useEffect(() => {
        fetchGames();
    }, []);

    const fetchGames = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'games'), orderBy('date', 'desc'));
            const snapshot = await getDocs(q);
            const loaded: Game[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Game));
            setGames(loaded);
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to load games');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (id: string) => {
        Alert.alert('Delete', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteDoc(doc(db, 'games', id));
                        fetchGames();
                    } catch (e) {
                        Alert.alert('Error', 'Delete failed');
                    }
                }
            }
        ]);
    };

    const filteredGames = games.filter(g => {
        if (!g.date) return false;
        const [y, m] = g.date.split('-');
        return y === selectedYear && parseInt(m).toString() === selectedMonth;
    });

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Game Schedule</Text>
                <TouchableOpacity style={styles.addButton} onPress={() => router.push('/admin/games/new')}>
                    <Text style={styles.addButtonText}>+ Add Game</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.filters}>
                <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Year:</Text>
                    <View style={styles.pillContainer}>
                        {years.map(y => (
                            <TouchableOpacity
                                key={y}
                                style={[styles.pill, selectedYear === y && styles.pillActive]}
                                onPress={() => setSelectedYear(y)}
                            >
                                <Text style={[styles.pillText, selectedYear === y && styles.pillTextActive]}>{y}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
                <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Month:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {months.map(m => (
                            <TouchableOpacity
                                key={m}
                                style={[styles.pill, selectedMonth === m && styles.pillActive]}
                                onPress={() => setSelectedMonth(m)}
                            >
                                <Text style={[styles.pillText, selectedMonth === m && styles.pillTextActive]}>{m}월</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" style={{ marginTop: 50 }} />
            ) : (
                <ScrollView style={styles.tableContainer}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.th, { flex: 1.5 }]}>Date/Time</Text>
                        <Text style={[styles.th, { flex: 2 }]}>Matchup</Text>
                        <Text style={[styles.th, { flex: 2 }]}>Stadium</Text>
                        <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Actions</Text>
                    </View>
                    {filteredGames.length === 0 ? (
                        <View style={styles.emptyRow}>
                            <Text style={styles.emptyText}>No games found for {selectedYear}-{selectedMonth}</Text>
                        </View>
                    ) : (
                        filteredGames.map(game => {
                            const homeExists = TEAMS.find(t => t.id === game.homeTeamId);
                            const awayExists = TEAMS.find(t => t.id === game.awayTeamId);
                            const homeName = homeExists ? homeExists.name : game.homeTeamId;
                            const awayName = awayExists ? awayExists.name : game.awayTeamId;

                            return (
                                <View key={game.id} style={styles.row}>
                                    <Text style={[styles.td, { flex: 1.5 }]}>{game.date} {game.time}</Text>
                                    <Text style={[styles.td, { flex: 2 }]}>{awayName} vs {homeName}</Text>
                                    <Text style={[styles.td, { flex: 2 }]}>{game.stadium}</Text>
                                    <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                                        <TouchableOpacity onPress={() => router.push(`/admin/games/${game.id}`)}>
                                            <Text style={styles.actionText}>Edit</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleDelete(game.id)}>
                                            <Text style={[styles.actionText, { color: 'red' }]}>Delete</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    addButton: {
        backgroundColor: '#000',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
    },
    addButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    filters: {
        marginBottom: 20,
        backgroundColor: '#f9f9f9',
        padding: 16,
        borderRadius: 8,
        gap: 16,
    },
    filterGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    filterLabel: {
        fontWeight: '600',
        width: 50,
    },
    pillContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    pill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    pillActive: {
        backgroundColor: '#000',
        borderColor: '#000',
    },
    pillText: {
        fontSize: 14,
        color: '#666',
    },
    pillTextActive: {
        color: '#fff',
    },
    tableContainer: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 8,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f0f0f0',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    th: {
        fontWeight: '700',
        color: '#333',
    },
    row: {
        flexDirection: 'row',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        alignItems: 'center',
    },
    td: {
        fontSize: 14,
        color: '#333',
    },
    actionText: {
        color: '#007AFF',
        fontWeight: '600',
    },
    emptyRow: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#999',
    }
});
