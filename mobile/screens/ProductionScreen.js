import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TextInput, TouchableOpacity, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import apiFetch from '../api/client';

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function ProductionScreen() {
  const [date] = useState(todayString());
  const [production, setProduction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [capacityInput, setCapacityInput] = useState('');
  const [savingCapacity, setSavingCapacity] = useState(false);

  const loadProduction = async () => {
    try {
      setError(null);
      const result = await apiFetch(`/production/${date}`);
      setProduction(result);
      setCapacityInput(result.daily_capacity ? String(result.daily_capacity) : '');
    } catch (err) {
      setError(err.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadProduction().finally(() => setLoading(false));
    }, [])
  );

  const handleSaveCapacity = async () => {
    setSavingCapacity(true);
    try {
      await apiFetch(`/production/${date}/capacity`, {
        method: 'PATCH',
        body: JSON.stringify({ daily_capacity: Number(capacityInput) || null }),
      });
      await loadProduction();
    } catch (err) {
      Alert.alert('Failed to save capacity', err.message);
    } finally {
      setSavingCapacity(false);
    }
  };

  const updateProduced = async (item, newQty) => {
    try {
      await apiFetch(`/production/items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ produced_qty: newQty }),
      });
      await loadProduction();
    } catch (err) {
      Alert.alert('Failed to update', err.message);
    }
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
        <Text style={styles.errorText}>Couldn't load production: {error}</Text>
      </View>
    );
  }

  const items = production?.items || [];
  const totalOrdered = items.reduce((sum, i) => sum + i.ordered_qty, 0);
  const totalProduced = items.reduce((sum, i) => sum + i.produced_qty, 0);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.dateText}>{date}</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryValue}>{totalProduced} / {totalOrdered}</Text>
        <Text style={styles.summaryLabel}>Total to Prepare</Text>
      </View>

      <View style={styles.capacityRow}>
        <Text style={styles.capacityLabel}>Daily Capacity:</Text>
        <TextInput
          style={styles.capacityInput}
          value={capacityInput}
          onChangeText={setCapacityInput}
          keyboardType="numeric"
          placeholder="e.g. 100"
        />
        <TouchableOpacity
          style={styles.saveCapacityButton}
          onPress={handleSaveCapacity}
          disabled={savingCapacity}
        >
          <Text style={styles.saveCapacityText}>Save</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Production Progress</Text>

      {items.length === 0 && (
        <Text style={styles.emptyText}>No orders for this date yet.</Text>
      )}

      {items.map((item) => {
        const pct = item.ordered_qty > 0
          ? Math.min(100, Math.round((item.produced_qty / item.ordered_qty) * 100))
          : 0;

        return (
          <View key={item.id} style={styles.productItem}>
            <View style={styles.productHeader}>
              <Text style={styles.productName}>{item.product_name}</Text>
              <Text style={styles.productCount}>
                {item.produced_qty} / {item.ordered_qty}
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
            </View>
            <View style={styles.produceButtons}>
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => updateProduced(item, Math.max(0, item.produced_qty - 1))}
              >
                <Text style={styles.stepButtonText}>-</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => updateProduced(item, item.produced_qty + 1)}
              >
                <Text style={styles.stepButtonText}>+</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.completeButton}
                onPress={() => updateProduced(item, item.ordered_qty)}
              >
                <Text style={styles.completeButtonText}>Mark Complete</Text>
              </TouchableOpacity>
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
  dateText: { fontSize: 14, color: '#666', marginBottom: 12 },
  summaryCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryValue: { fontSize: 32, fontWeight: 'bold' },
  summaryLabel: { fontSize: 13, color: '#666', marginTop: 4 },
  capacityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  capacityLabel: { fontSize: 14 },
  capacityInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
  },
  saveCapacityButton: {
    backgroundColor: '#2e7d32',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  saveCapacityText: { color: '#fff', fontWeight: 'bold' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  emptyText: { color: '#999', textAlign: 'center', marginTop: 20 },
  productItem: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  productName: { fontSize: 15, fontWeight: '600' },
  productCount: { fontSize: 14, color: '#666' },
  progressBarBg: {
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2e7d32',
  },
  produceButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepButtonText: { fontSize: 18, fontWeight: 'bold' },
  completeButton: {
    flex: 1,
    backgroundColor: '#2e7d32',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  completeButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
});