import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import apiFetch from '../api/client';

export default function DashboardScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadDashboard = async () => {
    try {
      setError(null);
      const result = await apiFetch('/dashboard');
      setData(result);
    } catch (err) {
      setError(err.message);
    }
  };

  // Reload every time the Dashboard tab is focused, so numbers stay fresh
  // as orders come in while Ate is on other screens.
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadDashboard().finally(() => setLoading(false));
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Couldn't load dashboard: {error}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.greeting}>Test Bibingka</Text>
      <Text style={styles.date}>{data.date}</Text>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardValue}>{data.total_orders}</Text>
          <Text style={styles.cardLabel}>Total Orders</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardValue}>{data.bibingka_to_prepare}</Text>
          <Text style={styles.cardLabel}>Bibingka to Prepare</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardValue}>₱{data.todays_sales}</Text>
          <Text style={styles.cardLabel}>Today's Sales</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardValue}>{data.pending_payments}</Text>
          <Text style={styles.cardLabel}>Pending Payments</Text>
        </View>
      </View>

      {data.pending_payments > 0 && (
        <View style={styles.alert}>
          <Text style={styles.alertText}>
            ⚠️ {data.pending_payments} payment(s) need verification
          </Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Status Breakdown</Text>
      {data.status_breakdown.map((row) => (
        <View key={row.status} style={styles.statusRow}>
          <Text style={styles.statusLabel}>{row.status.replace('_', ' ')}</Text>
          <Text style={styles.statusCount}>{row.count}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#c0392b', textAlign: 'center', paddingHorizontal: 24 },
  greeting: { fontSize: 22, fontWeight: 'bold' },
  date: { fontSize: 14, color: '#666', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  card: {
    flexBasis: '47%',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
  },
  cardValue: { fontSize: 24, fontWeight: 'bold' },
  cardLabel: { fontSize: 13, color: '#666', marginTop: 4 },
  alert: {
    backgroundColor: '#fdecea',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  alertText: { color: '#c0392b' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statusLabel: { textTransform: 'capitalize', color: '#333' },
  statusCount: { fontWeight: 'bold' },
});