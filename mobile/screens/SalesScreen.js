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

export default function SalesScreen() {
  const [sales, setSales] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSales = async () => {
    try {
      setError(null);
      const from = firstOfMonthString();
      const to = todayString();
      const result = await apiFetch(`/reports/sales?from=${from}&to=${to}`);
      setSales(result);
    } catch (err) {
      setError(err.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadSales().finally(() => setLoading(false));
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
        <Text style={styles.errorText}>Couldn't load sales: {error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionTitle}>This Month</Text>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardValue}>{sales.total_orders}</Text>
          <Text style={styles.cardLabel}>Total Orders</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardValue}>{sales.total_bibingka_sold}</Text>
          <Text style={styles.cardLabel}>Bibingka Sold</Text>
        </View>
        <View style={[styles.card, styles.cardWide]}>
          <Text style={styles.cardValue}>PHP {sales.gross_sales}</Text>
          <Text style={styles.cardLabel}>Gross Sales</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>By Product</Text>
      {sales.by_product.length === 0 && (
        <Text style={styles.emptyText}>No sales yet this month.</Text>
      )}
      {sales.by_product.map((row) => (
        <View key={row.name} style={styles.row}>
          <Text style={styles.rowLabel}>{row.name}</Text>
          <Text style={styles.rowValue}>{row.quantity} sold - PHP {row.total_sales}</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>By Day</Text>
      {sales.by_day.length === 0 && (
        <Text style={styles.emptyText}>No daily sales yet.</Text>
      )}
      {sales.by_day.map((row) => (
        <View key={row.date} style={styles.row}>
          <Text style={styles.rowLabel}>{row.date}</Text>
          <Text style={styles.rowValue}>PHP {row.total_sales}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#c0392b', textAlign: 'center', paddingHorizontal: 24 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 16, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    flexBasis: '47%',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
  },
  cardWide: { flexBasis: '100%' },
  cardValue: { fontSize: 22, fontWeight: 'bold' },
  cardLabel: { fontSize: 13, color: '#666', marginTop: 4 },
  emptyText: { color: '#999', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  rowLabel: { fontSize: 14 },
  rowValue: { fontSize: 14, fontWeight: '600' },
});