// services/emergencyAlert.js
import { onSnapshot, query, where, collection } from 'firebase/firestore';
import { db } from '../config/firebase';
import * as Location from 'expo-location';
import {
    triggerEmergencyAlertApi,
    updateAlertLocation,
    cancelAlertApi,
    updatePassiveLocation,
} from './api';

export const requestLocationPermission = async () => {
    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        return status === 'granted';
    } catch {
        return false;
    }
};

export const getCurrentLocation = async () => {
    const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
    });
    return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
    };
};

// Trigger an SOS via Node backend (handles nearby user detection + notifications)
export const triggerEmergencyAlert = async (userId, userName, options = {}) => {
    const location = await getCurrentLocation();

    const result = await triggerEmergencyAlertApi({
        userId,
        userName,
        latitude: location.latitude,
        longitude: location.longitude,
        selectedFriendUids: options.selectedFriendUids || [],
        radiusKm: options.radiusKm || 5,
    });

    // Also update passive location
    try {
        await updatePassiveLocation(userId, location.latitude, location.longitude);
    } catch (_) {}

    return result;
};

// Update location during active alert
export const updateEmergencyLocation = async (alertId, userId) => {
    const location = await getCurrentLocation();
    await updateAlertLocation(alertId, location.latitude, location.longitude);
    try {
        await updatePassiveLocation(userId, location.latitude, location.longitude);
    } catch (_) {}
    return location;
};

// Cancel alert via Node backend
export const cancelEmergencyAlert = async (alertId) => {
    await cancelAlertApi(alertId);
};

// Listen to active alerts from Firestore directly (realtime)
export const subscribeToEmergencyAlerts = (callback) => {
    const q = query(collection(db, 'emergencyAlerts'), where('status', '==', 'active'));
    return onSnapshot(q, (snapshot) => {
        const alerts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        callback(alerts);
    });
};

export const getUserActiveAlert = (alerts, userId) =>
    alerts.find((a) => a.userId === userId && a.status === 'active');

export const getTimeSinceAlert = (timestamp) => {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
};

// Update passive location (for radius-based emergency detection)
export const updateUserLocation = async (userId) => {
    try {
        const location = await getCurrentLocation();
        await updatePassiveLocation(userId, location.latitude, location.longitude);
    } catch (_) {}
};