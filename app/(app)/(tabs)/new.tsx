import { IconSymbol } from '@/components/ui/icon-symbol';
import { TEAMS } from '@/constants/teams';
import { useTheme } from '@/context/ThemeContext';
import { auth, db } from '@/src/config/firebase';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { addDoc, collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

interface Game {
  id: string;
  date: string;
  time: string;
  homeTeamId: string;
  awayTeamId: string;
  stadium: string;
  homeScore?: number;
  awayScore?: number;
  status: 'scheduled' | 'playing' | 'finished' | 'canceled';
}

export default function NewRecordScreen() {
  const navigation = useNavigation();
  const { selectedTeam } = useTheme();

  const [loading, setLoading] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [gamesLoading, setGamesLoading] = useState(false);

  // Form State
  const [formattedDate, setFormattedDate] = useState('');
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [result, setResult] = useState<'WIN' | 'LOSE' | 'DRAW' | 'SCHEDULED'>('WIN');
  const [stadium, setStadium] = useState('');
  const [seat, setSeat] = useState('');

  // New State: Which team did I cheer for? 'HOME' | 'AWAY'
  const [myTeamSide, setMyTeamSide] = useState<'HOME' | 'AWAY'>('HOME');

  // Track if data was auto-filled
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  const [recordedGames, setRecordedGames] = useState<Set<string>>(new Set());
  const [fieldErrors, setFieldErrors] = useState<{ score?: string; seat?: string }>({});
  const params = useLocalSearchParams();

  const primaryColor = selectedTeam?.primaryColor || '#F37321';

  // Handle params from Schedule or other sources
  React.useEffect(() => {
    if (params.gameDate) {
      const gameData: Game = {
        id: 'manual', // ID is not critical for filling form
        date: params.gameDate as string,
        time: params.time as string,
        homeTeamId: params.homeTeamId as string,
        awayTeamId: params.awayTeamId as string,
        stadium: params.stadium as string,
        homeScore: params.homeScore ? parseInt(params.homeScore as string) : undefined,
        awayScore: params.awayScore ? parseInt(params.awayScore as string) : undefined,
        status: (params.homeScore && params.awayScore) ? 'finished' : 'scheduled',
      };

      // Delay slightly to ensure UI is ready or just call it
      handleSelectGame(gameData);
    }
  }, [params]);

  // Fetch recorded games

  useFocusEffect(
    React.useCallback(() => {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(
        collection(db, 'records'),
        where('userId', '==', user.uid)
      );
      getDocs(q).then(snapshot => {
        const gameKeys = new Set<string>();
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.date) {
            const datePart = data.date.split(' ')[0];
            gameKeys.add(datePart);
          }
        });
        setRecordedGames(gameKeys);
      }).catch(error => {
        console.error('Error fetching recorded games:', error);
      });
    }, [])
  );

  // Effect to calculate result when side or scores change
  React.useEffect(() => {
    if (!homeScore && !awayScore) {
      if (isAutoFilled && result === 'SCHEDULED') return;
    }

    if (!homeScore || !awayScore) return;

    const hScore = parseInt(homeScore);
    const aScore = parseInt(awayScore);

    if (isNaN(hScore) || isNaN(aScore)) return;

    let myScore = myTeamSide === 'HOME' ? hScore : aScore;
    let opScore = myTeamSide === 'HOME' ? aScore : hScore;

    if (myScore > opScore) setResult('WIN');
    else if (myScore < opScore) setResult('LOSE');
    else setResult('DRAW');

  }, [homeScore, awayScore, myTeamSide]);

  const fetchGames = async () => {
    setGamesLoading(true);
    try {
      const q = query(collection(db, 'games'), orderBy('date', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedGames: Game[] = [];
      querySnapshot.forEach((doc) => {
        fetchedGames.push({ id: doc.id, ...doc.data() } as Game);
      });
      setGames(fetchedGames);
    } catch (error) {
      console.error('Error fetching games: ', error);
      Alert.alert('오류', '경기 목록을 불러오지 못했습니다.');
    } finally {
      setGamesLoading(false);
    }
  };

  const openGameModal = () => {
    setModalVisible(true);
    fetchGames();
  };

  const getTeamName = (id: string) => TEAMS.find(t => t.id === id)?.name || id;

  const handleSelectGame = (game: Game) => {
    const gameDate = new Date(game.date);

    // Auto-fill Data
    const dateStr = format(gameDate, 'yyyy-MM-dd');
    const dayStr = format(gameDate, 'E', { locale: ko });
    setFormattedDate(`${dateStr} (${dayStr})`);

    setHomeTeam(getTeamName(game.homeTeamId));
    setAwayTeam(getTeamName(game.awayTeamId));

    setStadium(game.stadium);

    // Handle Scores & Status
    if (game.status === 'scheduled') {
      setHomeScore('');
      setAwayScore('');
      setResult('SCHEDULED');
    } else {
      setHomeScore(game.homeScore != null ? game.homeScore.toString() : '');
      setAwayScore(game.awayScore != null ? game.awayScore.toString() : '');

      // Calculate initial result
      if (selectedTeam) {
        let myScore = 0;
        let opScore = 0;
        if (game.homeTeamId === selectedTeam.id) {
          myScore = game.homeScore || 0;
          opScore = game.awayScore || 0;
        } else if (game.awayTeamId === selectedTeam.id) {
          myScore = game.awayScore || 0;
          opScore = game.homeScore || 0;
        }

        if (game.homeTeamId === selectedTeam.id || game.awayTeamId === selectedTeam.id) {
          if (myScore > opScore) setResult('WIN');
          else if (myScore < opScore) setResult('LOSE');
          else setResult('DRAW');
        } else {
          // Neutral or no-cheer game logic fallback
          if ((game.homeScore || 0) === (game.awayScore || 0)) setResult('DRAW');
        }
      } else {
        // If no team selected, and finished
        if ((game.homeScore || 0) === (game.awayScore || 0)) setResult('DRAW');
      }
    }

    // Auto-select my team side
    if (selectedTeam) {
      if (game.homeTeamId === selectedTeam.id) {
        setMyTeamSide('HOME');
      } else if (game.awayTeamId === selectedTeam.id) {
        setMyTeamSide('AWAY');
      } else {
        setMyTeamSide('HOME');
      }
    }

    setIsAutoFilled(true);
    setModalVisible(false);
  };

  const validateForm = (): boolean => {
    const errors: { score?: string; seat?: string } = {};

    if (homeScore !== '' || awayScore !== '') {
      const h = Number(homeScore);
      const a = Number(awayScore);
      const invalid = (v: number) => isNaN(v) || !Number.isInteger(v) || v < 0 || v > 99;
      if (invalid(h) || invalid(a)) {
        errors.score = '스코어는 0~99 사이의 정수여야 합니다.';
      }
    }

    if (seat.length > 100) {
      errors.seat = `좌석 정보는 100자 이내로 입력해주세요. (현재 ${seat.length}자)`;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!formattedDate || !homeTeam || !awayTeam || !stadium) {
      Alert.alert('알림', '필수 항목(날짜, 팀, 경기장)이 누락되었습니다.');
      return;
    }

    if (!validateForm()) return;

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('오류', '로그인이 필요합니다.');
        return;
      }

      const matchup = `${awayTeam} vs ${homeTeam}`;
      const score = (result === 'SCHEDULED') ? '' : `${awayScore}:${homeScore}`;

      await addDoc(collection(db, 'records'), {
        userId: user.uid,
        date: formattedDate,
        day: '',
        matchup,
        result,
        score,
        stadium,
        seat,
        myTeamSide, // Save cheering side
        createdAt: new Date(),
      });
      Alert.alert('성공', '직관 기록이 저장되었습니다.', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert('오류', '기록 저장 중 문제가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const renderGameItem = ({ item }: { item: Game }) => {
    const hName = getTeamName(item.homeTeamId);
    const aName = getTeamName(item.awayTeamId);
    const isRecorded = recordedGames.has(item.date);

    return (
      <TouchableOpacity
        style={[styles.gameItem, isRecorded && styles.disabledGameItem]}
        onPress={() => !isRecorded && handleSelectGame(item)}
        disabled={isRecorded}
      >
        <View>
          <Text style={[styles.gameDate, isRecorded && { color: '#999' }]}>{item.date} {item.time}</Text>
          <Text style={[styles.gameTitle, isRecorded && { color: '#999' }]}>{aName} vs {hName}</Text>
          <Text style={styles.gameSubtitle}>{item.stadium}</Text>
        </View>

        {isRecorded ? (
          <View style={styles.recordedBadge}>
            <Text style={styles.recordedText}>기록됨</Text>
          </View>
        ) : (
          <IconSymbol name="chevron.right" size={20} color="#ccc" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>새 기록 등록</Text>

        {!isAutoFilled ? (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateText}>
              등록할 경기를 선택해주세요.
            </Text>
            <TouchableOpacity style={[styles.loadButton, { borderColor: primaryColor }]} onPress={openGameModal}>
              <IconSymbol name="calendar" size={20} color={primaryColor} />
              <Text style={[styles.loadButtonText, { color: primaryColor }]}>경기 일정에서 불러오기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.goScheduleButton}
              onPress={() => navigation.navigate('schedule' as never)}
            >
              <Text style={styles.goScheduleText}>경기 일정 화면으로 이동</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity style={[styles.loadButton, { borderColor: primaryColor }]} onPress={openGameModal}>
              <IconSymbol name="calendar" size={20} color={primaryColor} />
              <Text style={[styles.loadButtonText, { color: primaryColor }]}>경기 다시 선택하기</Text>
            </TouchableOpacity>

            <View style={styles.formGroup}>
              <Text style={styles.label}>날짜</Text>
              <TextInput
                style={[styles.input, isAutoFilled && styles.readOnlyInput]}
                placeholder="yyyy-MM-dd (Day)"
                value={formattedDate}
                onChangeText={setFormattedDate}
                editable={!isAutoFilled}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>원정팀</Text>
                <TouchableOpacity
                  style={[
                    styles.teamSelectButton,
                    myTeamSide === 'AWAY' && { borderColor: primaryColor, backgroundColor: primaryColor + '10' }
                  ]}
                  onPress={() => setMyTeamSide('AWAY')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.teamSelectText, myTeamSide === 'AWAY' && { color: primaryColor, fontWeight: 'bold' }]}>
                    {awayTeam || 'Away'}
                  </Text>
                  {myTeamSide === 'AWAY' && (
                    <View style={[styles.badgeCheck, { backgroundColor: primaryColor }]}>
                      <IconSymbol name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <View style={[styles.centerVs, { paddingTop: 24 }]}>
                <Text style={styles.vsText}>vs</Text>
              </View>

              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>홈팀</Text>
                <TouchableOpacity
                  style={[
                    styles.teamSelectButton,
                    myTeamSide === 'HOME' && { borderColor: primaryColor, backgroundColor: primaryColor + '10' }
                  ]}
                  onPress={() => setMyTeamSide('HOME')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.teamSelectText, myTeamSide === 'HOME' && { color: primaryColor, fontWeight: 'bold' }]}>
                    {homeTeam || 'Home'}
                  </Text>
                  {myTeamSide === 'HOME' && (
                    <View style={[styles.badgeCheck, { backgroundColor: primaryColor }]}>
                      <IconSymbol name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.helperText}>* 응원하는 팀을 선택해주세요.</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>점수</Text>
              <View style={styles.scoreContainer}>
                <View style={styles.scoreInputWrapper}>
                  <Text style={styles.scoreLabel}>원정</Text>
                  <TextInput
                    style={[styles.input, styles.scoreInput, isAutoFilled && styles.readOnlyInput, fieldErrors.score && styles.inputError]}
                    placeholder="0"
                    value={awayScore}
                    onChangeText={(v) => { setAwayScore(v); setFieldErrors(e => ({ ...e, score: undefined })); }}
                    keyboardType="number-pad"
                    editable={!isAutoFilled}
                    maxLength={2}
                  />
                </View>
                <Text style={styles.scoreSeparator}>:</Text>
                <View style={styles.scoreInputWrapper}>
                  <Text style={styles.scoreLabel}>홈</Text>
                  <TextInput
                    style={[styles.input, styles.scoreInput, isAutoFilled && styles.readOnlyInput, fieldErrors.score && styles.inputError]}
                    placeholder="0"
                    value={homeScore}
                    onChangeText={(v) => { setHomeScore(v); setFieldErrors(e => ({ ...e, score: undefined })); }}
                    keyboardType="number-pad"
                    editable={!isAutoFilled}
                    maxLength={2}
                  />
                </View>
              </View>
              {fieldErrors.score && <Text style={styles.errorText}>{fieldErrors.score}</Text>}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>결과 (자동 계산)</Text>
              <View style={[
                styles.resultDisplay,
                {
                  backgroundColor: result === 'WIN' ? '#D32F2F'
                    : result === 'LOSE' ? '#1976D2'
                      : result === 'SCHEDULED' ? '#bbb'
                        : '#757575'
                }
              ]}>
                <Text style={styles.resultDisplayText}>
                  {result === 'SCHEDULED' ? '예정' : result}
                </Text>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>경기장</Text>
              <TextInput
                style={[styles.input, isAutoFilled && styles.readOnlyInput]}
                placeholder="Stadium"
                value={stadium}
                onChangeText={setStadium}
                editable={!isAutoFilled}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>좌석 (직접 입력)</Text>
              <TextInput
                style={[styles.input, styles.activeInput, fieldErrors.seat && styles.inputError]}
                placeholder="예: 1루 응원석 105구역"
                value={seat}
                onChangeText={(v) => { setSeat(v); setFieldErrors(e => ({ ...e, seat: undefined })); }}
                autoFocus={isAutoFilled}
                maxLength={100}
              />
              {fieldErrors.seat
                ? <Text style={styles.errorText}>{fieldErrors.seat}</Text>
                : <Text style={styles.charCount}>{seat.length}/100</Text>
              }
            </View>

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: primaryColor }]}
              onPress={handleSave}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>저장하기</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Game Selection Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>경기 선택</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButton}>닫기</Text>
            </TouchableOpacity>
          </View>

          {gamesLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" />
            </View>
          ) : (
            <FlatList
              data={games}
              keyExtractor={(item) => item.id}
              renderItem={renderGameItem}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>등록된 경기 일정이 없습니다.</Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  loadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    backgroundColor: '#fff',
    gap: 8,
  },
  loadButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
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
    backgroundColor: '#fff',
  },
  readOnlyInput: {
    backgroundColor: '#f0f0f0',
    color: '#888',
  },
  activeInput: {
    borderColor: '#333',
    borderWidth: 1.5,
  },
  inputError: {
    borderColor: '#D32F2F',
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: '#D32F2F',
  },
  charCount: {
    marginTop: 4,
    fontSize: 12,
    color: '#bbb',
    textAlign: 'right',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreInputWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  scoreInput: {
    width: '100%',
    textAlign: 'center',
    fontWeight: '700',
  },
  scoreSeparator: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ccc',
    marginHorizontal: 12,
    marginTop: 16,
  },
  teamSelectButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 50,
  },
  teamSelectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  badgeCheck: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  centerVs: {
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vsText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#aaa',
    marginTop: 24,
  },
  helperText: {
    fontSize: 12,
    color: '#888',
    marginTop: -8,
    marginBottom: 16,
    textAlign: 'center',
  },
  resultDisplay: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultDisplayText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  resultButton: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  resultButtonActive: {
    borderColor: 'transparent',
  },
  resultButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  resultButtonTextActive: {
    color: '#fff',
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  gameItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  disabledGameItem: {
    backgroundColor: '#f9f9f9',
    opacity: 0.6,
  },
  recordedBadge: {
    backgroundColor: '#eee',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  recordedText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
  },
  gameDate: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  gameTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  gameSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
  },
  emptyStateContainer: {
    flex: 1,
    paddingVertical: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
    fontWeight: '600',
  },
  goScheduleButton: {
    padding: 12,
    marginTop: 10,
  },
  goScheduleText: {
    fontSize: 14,
    color: '#888',
    textDecorationLine: 'underline',
  },
});
