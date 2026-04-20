import { IconSymbol } from '@/components/ui/icon-symbol';
import { useFilter } from '@/context/FilterContext';
import { useTheme } from '@/context/ThemeContext';
import TicketCard, { TicketResult } from '@/src/components/TicketCard';
import { auth, db } from '@/src/config/firebase';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface TicketRecord {
  id: string;
  date: string;
  day: string;
  matchup: string;
  result: TicketResult;
  score: string;
  stadium: string;
  seat: string;
  createdAt?: any;
}

export default function HomeScreen() {
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<TicketRecord[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const { selectedYear, setSelectedYear } = useFilter();
  const [loading, setLoading] = useState(true);
  const { selectedTeam } = useTheme();
  const router = useRouter();

  const primaryColor = selectedTeam?.primaryColor || '#000';
  const secondaryColor = selectedTeam?.secondaryColor || '#666';

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'records'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records: TicketRecord[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<TicketRecord, 'id'>),
      }));

      const uniqueYears = Array.from(
        new Set(records.map(r =>
          r.date.includes('-') ? r.date.split('-')[0] : new Date().getFullYear().toString()
        ))
      ).sort((a, b) => b.localeCompare(a));

      setYears(uniqueYears);
      setTickets(records);
      setLoading(false);

      // 현재 선택 연도가 실제 데이터에 없으면 가장 최근 연도로 자동 보정
      if (uniqueYears.length > 0 && !uniqueYears.includes(selectedYear.toString())) {
        setSelectedYear(parseInt(uniqueYears[0]));
      }
    });

    return () => unsubscribe();
  }, []);

  // Filter tickets when year or tickets change
  useEffect(() => {
    if (!selectedYear) {
      // Should not happen with context default, but safe guard
      setFilteredTickets(tickets);
    } else {
      const filtered = tickets.filter(t => t.date.startsWith(selectedYear.toString()));
      setFilteredTickets(filtered);
    }
  }, [selectedYear, tickets]);


  const handleDelete = (id: string, matchup: string) => {
    Alert.alert('기록 삭제', `'${matchup}' 기록을 정말 삭제하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'records', id));
          } catch (error) {
            console.error('Delete error:', error);
            Alert.alert('오류', '삭제 중 문제가 발생했습니다.');
          }
        },
      },
    ]);
  };

  const handlePressCard = (id: string) => {
    // @ts-ignore: Typed routes issue until file created
    router.push(`/record/${id}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.titleWrapper}>
            <Text style={[styles.title, { color: primaryColor }]}>직관 기록</Text>
            <View style={[styles.badge, { backgroundColor: primaryColor }]}>
              <Text style={[styles.badgeText, { color: '#fff' }]}>
                {filteredTickets.length} Games
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push('/settings')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <IconSymbol name="gear" size={24} color={secondaryColor} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerBottom}>
          <Text style={[styles.teamName, { color: secondaryColor }]}>
            {selectedTeam ? selectedTeam.name : '구단을 선택해주세요'}
          </Text>

          {/* Year Selector Dropdown */}
          <TouchableOpacity
            style={styles.yearSelector}
            onPress={() => {
              const options = years.length > 0 ? years : [new Date().getFullYear().toString()];
              Alert.alert('연도 선택', '', [
                ...options.map(y => ({ text: `${y}년`, onPress: () => setSelectedYear(parseInt(y)) })),
                { text: '취소', style: 'cancel' }
              ]);
            }}
          >
            <Text style={styles.yearText}>{selectedYear}년 ▼</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <FlatList
          data={filteredTickets}
          keyExtractor={(item) => item.id}
          renderItem={({ item }: { item: TicketRecord }) => (
            <TouchableOpacity activeOpacity={0.9} onPress={() => handlePressCard(item.id)}>
              <TicketCard
                date={item.date}
                day={item.day}
                matchup={item.matchup}
                result={item.result}
                score={item.score}
                stadium={item.stadium}
                seat={item.seat}
                teamColor={primaryColor}
                onDelete={() => handleDelete(item.id, item.matchup)}
              />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>&apos;{selectedYear}&apos;년 기록이 없습니다.</Text>
              <Text style={styles.emptySubText}>+ 버튼을 눌러 기록을 추가해보세요!</Text>
            </View>
          }
        />
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  headerBottom: {
    marginTop: 4,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  yearSelector: {
    flexDirection: 'row',
    marginTop: 4,
  },
  yearScroll: {
    gap: 8,
    paddingBottom: 4, // for shadow visibility if needed
  },
  yearChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  yearText: {
    fontSize: 14,
    color: '#666',
  },
  listContent: {
    paddingBottom: 20,
    paddingTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingTop: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#888',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#aaa',
  },
});
