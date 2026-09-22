import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TextInput, TouchableOpacity, Switch, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import apiFetch from '../api/client';

const PAYMENT_METHOD_OPTIONS = [
  { key: 'gcash', label: 'GCash' },
  { key: 'cash', label: 'Cash' },
  { key: 'bank_transfer', label: 'Bank Transfer' },
];

// pickup_times is stored as a JSON array of strings, e.g. ["10:00 AM", "2:00 PM"].
// Edited here as a comma-separated text field and split/joined on save/load.
function pickupTimesToText(pickupTimes) {
  if (!Array.isArray(pickupTimes)) return '';
  return pickupTimes.join(', ');
}

function textToPickupTimes(text) {
  return text
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export default function SettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [googleFormUrl, setGoogleFormUrl] = useState('');
  const [pickupTimesText, setPickupTimesText] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState({});

  const loadSettings = async () => {
    try {
      setError(null);
      const result = await apiFetch('/settings');
      setBusinessName(result.business_name || '');
      setGoogleFormUrl(result.google_form_url || '');
      setPickupTimesText(pickupTimesToText(result.pickup_times));
      setNotificationsEnabled(!!result.notifications_enabled);

      // payment_methods_enabled is stored as JSON, e.g. { gcash: true, cash: true }.
      // Default any option not yet present in the stored settings to false.
      const stored = result.payment_methods_enabled || {};
      const merged = {};
      PAYMENT_METHOD_OPTIONS.forEach(({ key }) => {
        merged[key] = !!stored[key];
      });
      setPaymentMethods(merged);
    } catch (err) {
      setError(err.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadSettings().finally(() => setLoading(false));
    }, [])
  );

  const togglePaymentMethod = (key) => {
    setPaymentMethods((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch('/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          business_name: businessName.trim(),
          google_form_url: googleFormUrl.trim(),
          pickup_times: textToPickupTimes(pickupTimesText),
          payment_methods_enabled: paymentMethods,
          notifications_enabled: notificationsEnabled,
        }),
      });
      Alert.alert('Saved', 'Settings updated.');
    } catch (err) {
      Alert.alert('Failed to save settings', err.message);
    } finally {
      setSaving(false);
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
        <Text style={styles.errorText}>Couldn't load settings: {error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionTitle}>Business</Text>
      <View style={styles.field}>
        <Text style={styles.label}>Business Name</Text>
        <TextInput
          style={styles.input}
          value={businessName}
          onChangeText={setBusinessName}
          placeholder="Bibingka ni Ate"
        />
      </View>

      <Text style={styles.sectionTitle}>Orders</Text>
      <View style={styles.field}>
        <Text style={styles.label}>Google Form URL</Text>
        <TextInput
          style={styles.input}
          value={googleFormUrl}
          onChangeText={setGoogleFormUrl}
          placeholder="https://forms.gle/..."
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Text style={styles.hint}>
          The link you send customers on Messenger to place an order.
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Pickup / Delivery Times</Text>
        <TextInput
          style={styles.input}
          value={pickupTimesText}
          onChangeText={setPickupTimesText}
          placeholder="10:00 AM, 2:00 PM, 4:00 PM"
        />
        <Text style={styles.hint}>
          Comma-separated list of time slots customers can choose from.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Payment Methods</Text>
      {PAYMENT_METHOD_OPTIONS.map(({ key, label }) => (
        <View key={key} style={styles.switchRow}>
          <Text style={styles.switchLabel}>{label}</Text>
          <Switch
            value={!!paymentMethods[key]}
            onValueChange={() => togglePaymentMethod(key)}
          />
        </View>
      ))}

      <Text style={styles.sectionTitle}>Notifications</Text>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Enable notifications</Text>
        <Switch
          value={notificationsEnabled}
          onValueChange={setNotificationsEnabled}
        />
      </View>
      <Text style={styles.hint}>
        Push notifications aren't set up yet — this just saves the preference for later.
      </Text>

      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#c0392b', textAlign: 'center', paddingHorizontal: 24 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
  },
  hint: { fontSize: 12, color: '#999', marginTop: 4 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  switchLabel: { fontSize: 15 },
  saveButton: {
    backgroundColor: '#2e7d32',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  saveButtonText: { color: '#fff', fontWeight: 'bold' },
});