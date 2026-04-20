import { IconSymbol } from '@/components/ui/icon-symbol';
import { TEAMS } from '@/constants/teams';
import { useFilter } from '@/context/FilterContext';
import { useTheme } from '@/context/ThemeContext';
import { auth, db } from '@/src/config/firebase';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useFocusEffect, useRouter } from 'expo-router';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Game {
    id: string;
    date: string; // YYYY-MM-DD
    time: string;
    homeTeamId: string;
    awayTeamId: string;
    stadium: string;
    homeScore?: number;
    awayScore?: number;
    status: 'scheduled' | 'playing' | 'finished' | 'canceled';
}

export default function ScheduleScreen() {
    const [games, setGames] = useState<Game[]>([]);
    const [filteredGames, setFilteredGames] = useState<Game[]>([]); // Games filtered by year
    const [monthlyGames, setMonthlyGames] = useState<{ date: string; data: Game[] }[]>([]); // Games filtered by month
    const [availableYears, setAvailableYears] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [recordedGameDates, setRecordedGameDates] = useState<Set<string>>(new Set());
    const [months, setMonths] = useState<number[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);

    const { selectedTeam } = useTheme();
    const { selectedYear, setSelectedYear } = useFilter();
    const router = useRouter();

    const primaryColor = selectedTeam?.primaryColor || '#000';

    // Fetch duplicate check data when screen focuses
    useFocusEffect(
        useCallback(() => {
            fetchRecordedGames();
        }, [])
    );

    useEffect(() => {
        fetchGames();
    }, []);

    // Filter games when year/month changes
    useEffect(() => {
        if (!games.length) return;

        // 1. Filter by Year
        const yearFiltered = games.filter(g => g.date.startsWith(selectedYear.toString()));
        setFilteredGames(yearFiltered);

        // 2. Extract Months
        const uniqueMonths = Array.from(new Set(yearFiltered.map(g => parseInt(g.date.split('-')[1]))))
            .sort((a, b) => a - b);
        setMonths(uniqueMonths);

        // 3. Auto-select month if current selection invalid
        if (!uniqueMonths.includes(selectedMonth) && uniqueMonths.length > 0) {
            setSelectedMonth(uniqueMonths[0]);
        }
    }, [games, selectedYear]);

    // Apply Month Filter
    useEffect(() => {
        if (!filteredGames.length) {
            setMonthlyGames([]);
            return;
        }
        const monthFiltered = filteredGames.filter(g => parseInt(g.date.split('-')[1]) === selectedMonth);
        setMonthlyGames(groupGamesByDate(monthFiltered));
    }, [filteredGames, selectedMonth]);

    const fetchRecordedGames = async () => {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const q = query(
                collection(db, 'records'),
                where('userId', '==', user.uid)
            );
            const snapshot = await getDocs(q);
            const dates = new Set<string>();
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.date) dates.add(data.date.split(' ')[0]);
            });
            setRecordedGameDates(dates);
        } catch (error) {
            console.error('Error fetching recorded games:', error);
        }
    };

    const fetchGames = async () => {
        setLoading(true);
        setIsError(false);
        try {
            const q = query(collection(db, 'games'), orderBy('date', 'asc'));
            const querySnapshot = await getDocs(q);
            const fetchedGames: Game[] = [];
            querySnapshot.forEach((doc) => {
                fetchedGames.push({ id: doc.id, ...doc.data() } as Game);
            });

            fetchedGames.sort((a, b) => {
                if (a.date !== b.date) return a.date.localeCompare(b.date);
                return a.time.localeCompare(b.time);
            });

            setGames(fetchedGames);

            const years = Array.from(new Set(fetchedGames.map(g => g.date.split('-')[0]))).sort((a, b) => b.localeCompare(a));
            const currentYear = new Date().getFullYear().toString();
            if (!years.includes(currentYear)) years.unshift(currentYear);
            setAvailableYears(years);
        } catch (error) {
            console.error('Error fetching games: ', error);
            setIsError(true);
        } finally {
            setLoading(false);
        }
    };

    const getTeamInfo = (id: string) => TEAMS.find((t) => t.id === id);

    const groupGamesByDate = (games: Game[]) => {
        const grouped: { [key: string]: Game[] } = {};
        games.forEach((game) => {
            if (!grouped[game.date]) {
                grouped[game.date] = [];
            }
            grouped[game.date].push(game);
        });
        return Object.keys(grouped).map((date) => ({
            date,
            data: grouped[date],
        }));
    };

    const sections = groupGamesByDate(games);

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const renderGameItem = ({ item }: { item: Game }) => {
        const homeTeam = getTeamInfo(item.homeTeamId);
        const awayTeam = getTeamInfo(item.awayTeamId);
        const isToday = item.date === todayStr;
        const isRecorded = recordedGameDates.has(item.date);

        return (
            <View style={[
                styles.gameCard,
                isToday && { borderWidth: 2, borderColor: primaryColor }
            ]}>
                {isToday && (
                    <View style={[styles.todayBadge, { backgroundColor: primaryColor }]}>
                        <Text style={styles.todayText}>TODAY</Text>
                    </View>
                )}
                <View style={styles.gameInfo}>
                    <Text style={styles.time}>{item.time}</Text>
                    <Text style={styles.stadium}>{item.stadium}</Text>
                </View>
                <View style={styles.matchup}>
                    <View style={styles.teamContainer}>
                        {awayTeam?.image && <Image source={awayTeam.image} style={styles.logo} resizeMode="contain" />}
                        <Text style={styles.teamName}>{awayTeam?.name}</Text>
                    </View>

                    <View style={styles.centerContainer}>
                        {item.status === 'finished' && item.awayScore !== undefined && item.homeScore !== undefined ? (
                            <Text style={styles.scoreText}>
                                {item.awayScore} <Text style={styles.vs}>:</Text> {item.homeScore}
                            </Text>
                        ) : item.status === 'canceled' ? (
                            <Text style={styles.statusText}>취소</Text>
                        ) : (
                            <Text style={styles.statusText}>예정</Text>
                        )}
                    </View>

                    <View style={styles.teamContainer}>
                        {homeTeam?.image && <Image source={homeTeam.image} style={styles.logo} resizeMode="contain" />}
                        <Text style={styles.teamName}>{homeTeam?.name}</Text>
                    </View>
                </View>

                {/* Add Record Button - Hidden if recorded */}
                {!isRecorded && (
                    <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: primaryColor }]}
                        onPress={() => {
                            router.push({
                                pathname: '/new',
                                params: {
                                    gameDate: item.date,
                                    homeTeamId: item.homeTeamId,
                                    awayTeamId: item.awayTeamId,
                                    stadium: item.stadium,
                                    time: item.time,
                                    homeScore: item.homeScore?.toString(), // Pass strings for params
                                    awayScore: item.awayScore?.toString()
                                }
                            });
                        }}
                    >
                        <IconSymbol name="plus" size={20} color="#fff" />
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                {/* Year Display (Read-only) */}
                <View style={styles.yearContainer}>
                    <Text style={[styles.title, { color: primaryColor }]}>{selectedYear}년</Text>
                </View>

            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={primaryColor} />
                </View>
            ) : isError ? (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>경기 일정을 불러오지 못했습니다.</Text>
                    <TouchableOpacity style={[styles.retryButton, { borderColor: primaryColor }]} onPress={fetchGames}>
                        <Text style={[styles.retryButtonText, { color: primaryColor }]}>다시 시도</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    {/* Month Selector: Fixed 3~10 */}
                    <View style={styles.monthSelector}>
                        <FlatList
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            data={[3, 4, 5, 6, 7, 8, 9, 10]}
                            keyExtractor={(item) => item.toString()}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.monthChip,
                                        selectedMonth === item && { backgroundColor: primaryColor }
                                    ]}
                                    onPress={() => setSelectedMonth(item)}
                                >
                                    <Text style={[
                                        styles.monthText,
                                        selectedMonth === item && { color: '#fff', fontWeight: 'bold' }
                                    ]}>{item}월</Text>
                                </TouchableOpacity>
                            )}
                            contentContainerStyle={styles.monthScroll}
                        />
                    </View>

                    <FlatList
                        data={monthlyGames}
                        keyExtractor={(item) => item.date}
                        renderItem={({ item }) => (
                            <View>
                                <View style={styles.dateHeader}>
                                    <Text style={styles.dateText}>
                                        {format(new Date(item.date), 'M월 d일 EEEE', { locale: ko })}
                                    </Text>
                                </View>
                                {item.data.map((game) => (
                                    <View key={game.id} style={styles.gameWrapper}>
                                        {renderGameItem({ item: game })}
                                    </View>
                                ))}
                            </View>
                        )}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>등록된 경기가 없습니다.</Text>
                            </View>
                        }
                    />
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    yearContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingBottom: 20,
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
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#999',
        fontSize: 14,
    },
    dateHeader: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#f9f9f9',
    },
    dateText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333',
    },
    gameWrapper: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    gameCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    gameInfo: {
        width: 80,
        borderRightWidth: 1,
        borderRightColor: '#eee',
        marginRight: 16,
        justifyContent: 'center',
    },
    time: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    stadium: {
        fontSize: 11,
        color: '#888',
    },
    matchup: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    teamContainer: {
        flex: 1,
        alignItems: 'center',
        gap: 4,
    },
    logo: {
        width: 32,
        height: 32,
    },
    teamName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#333',
        textAlign: 'center',
    },
    todayBadge: {
        position: 'absolute',
        top: 0,
        left: 0,
        borderBottomRightRadius: 8,
        borderTopLeftRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
        zIndex: 1,
    },
    todayText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    centerContainer: {
        width: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scoreText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#000',
    },
    statusText: {
        fontSize: 12,
        color: '#666',
        backgroundColor: '#eee',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        overflow: 'hidden',
    },
    vs: {
        fontSize: 14,
        color: '#999',
        fontWeight: '600',
        paddingHorizontal: 4,
    },
    monthSelector: {
        backgroundColor: '#fff',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    monthScroll: {
        paddingHorizontal: 16,
        gap: 8,
    },
    monthChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f5f5f5',
    },
    monthText: {
        fontSize: 14,
        color: '#666',
    },
    addButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 12,
    },
    recordedButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#ccc',
        marginLeft: 12,
    },
    recordedText: {
        fontSize: 12,
        color: '#fff',
        fontWeight: 'bold',
    },
});
