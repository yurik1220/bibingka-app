import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import apiFetch from '../api/client';

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function ReportsScreen() {
  const [bestSellers, setBestSellers] = useState([]);
  const [pickupTimes, setPickupTimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadReports = async () => {
    try {
      setError(null);
      const from = firstOfMonthString();
      const to = todayString();

      const [bestSellersResult, pickupTimesResult] = await Promise.all([
        apiFetch(`/reports/best-sellers?from=${from}&to=${to}`),
        apiFetch(`/reports/pickup-times?from=${from}&to=${to}`),
      ]);

      setBestSellers(bestSellersResult);
      setPickupTimes(pickupTimesResult);
    } catch (err) {
      setError(err.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadReports().finally(() => setLoading(false));
    }, [])
  );

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
        <Text style={styles.errorText}>Couldn't load reports: {error}</Text>
      </View>
    );
  }

  const maxSold = bestSellers.length > 0
    ? Math.max(...bestSellers.map((r) => Number(r.total_sold)))
    : 0;
  const maxOrderCount = pickupTimes.length > 0
    ? Math.max(...pickupTimes.map((r) => Number(r.order_count)))
    : 0;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionTitle}>Best Sellers</Text>
      <Text style={styles.sectionSubtitle}>This month</Text>

      {bestSellers.length === 0 && (
        <Text style={styles.emptyText}>No sales yet this month.</Text>
      )}
      {bestSellers.map((row, index) => {
        const pct = maxSold > 0 ? Math.round((Number(row.total_sold) / maxSold) * 100) : 0;
        return (
          <View key={row.name} style={styles.barRow}>
            <View style={styles.barRowHeader}>
              <Text style={styles.barRank}>{index + 1}.</Text>
              <Text style={styles.barLabel}>{row.name}</Text>
              <Text style={styles.barValue}>{row.total_sold} sold</Text>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${pct}%` }]} />
            </View>
          </View>
        );
      })}

      <Text style={styles.sectionTitle}>Pickup / Delivery Time Popularity</Text>
      <Text style={styles.sectionSubtitle}>This month</Text>

      {pickupTimes.length === 0 && (
        <Text style={styles.emptyText}>No orders yet this month.</Text>
      )}
      {pickupTimes.map((row) => {
        const pct = maxOrderCount > 0
          ? Math.round((Number(row.order_count) / maxOrderCount) * 100)
          : 0;
        return (
          <View key={row.pickup_time || 'unspecified'} style={styles.barRow}>
            <View style={styles.barRowHeader}>
              <Text style={styles.barLabel}>{row.pickup_time || 'Unspecified'}</Text>
              <Text style={styles.barValue}>{row.order_count} order(s)</Text>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, styles.barFillAlt, { width: `${pct}%` }]} />
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#c0392b', textAlign: 'center', paddingHorizontal: 24 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 2 },
  sectionSubtitle: { fontSize: 12, color: '#999', marginBottom: 12 },
  emptyText: { color: '#999', marginBottom: 8 },
  barRow: { marginBottom: 14 },
  barRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  barRank: { fontSize: 13, color: '#999', width: 18 },
  barLabel: { flex: 1, fontSize: 14 },
  barValue: { fontSize: 13, color: '#666', fontWeight: '600' },
  barBg: {
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#2e7d32',
  },
  barFillAlt: {
    backgroundColor: '#2980b9',
  },
});