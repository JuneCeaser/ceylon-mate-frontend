// app/(tourist)/profile.js
import React, { useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Modal,
    TextInput,
    ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { searchAppUsers } from '../../services/api';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { Colors, Spacing, BorderRadius } from '../../constants/theme';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

export default function ProfileScreen() {
    const router = useRouter();
    const { user, userProfile, logout } = useAuth();

    const [profile, setProfile] = useState(null);
    const [saving, setSaving] = useState(false);

    // Medical details state
    const [medModal, setMedModal] = useState(false);
    const [med, setMed] = useState({
        bloodType: '',
        allergies: '',
        conditions: '',
        medications: '',
        emergencyNotes: '',
    });

    // Emergency contacts state
    const [contactsModal, setContactsModal] = useState(false);
    const [contactSearch, setContactSearch] = useState('');
    const [contactResults, setContactResults] = useState([]);
    const [contactSearching, setContactSearching] = useState(false);
    const contactSearchTimer = useRef(null);

    // Location sharing state
    const [sharingModal, setSharingModal] = useState(false);
    const [shareSearch, setShareSearch] = useState('');
    const [shareResults, setShareResults] = useState([]);
    const [shareSearching, setShareSearching] = useState(false);
    const shareSearchTimer = useRef(null);

    useFocusEffect(
        useCallback(() => {
            loadProfile();
        }, [user])
    );

    const loadProfile = async () => {
        if (!user?.uid) return;
        try {
            const snap = await getDoc(doc(db, 'users', user.uid));
            if (snap.exists()) {
                const data = { uid: snap.id, ...snap.data() };
                setProfile(data);
                if (data.medicalDetails) {
                    setMed({
                        bloodType: data.medicalDetails.bloodType || '',
                        allergies: data.medicalDetails.allergies || '',
                        conditions: data.medicalDetails.conditions || '',
                        medications: data.medicalDetails.medications || '',
                        emergencyNotes: data.medicalDetails.emergencyNotes || '',
                    });
                }
            }
        } catch (err) {
            console.error('Profile load error:', err);
        }
    };

    const saveField = async (field, value) => {
        if (!user?.uid) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, 'users', user.uid), { [field]: value });
            setProfile((prev) => ({ ...prev, [field]: value }));
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setSaving(false);
        }
    };

    // ── Medical details ────────────────────────────────────────────────────────
    const saveMedical = async () => {
        await saveField('medicalDetails', med);
        setMedModal(false);
    };

    // ── Emergency contacts ────────────────────────────────────────────────────
    const currentContacts = profile?.emergencyContacts || [];

    const handleContactSearch = (text) => {
        setContactSearch(text);
        clearTimeout(contactSearchTimer.current);
        if (text.trim().length < 2) { setContactResults([]); return; }
        contactSearchTimer.current = setTimeout(async () => {
            setContactSearching(true);
            try {
                const results = await searchAppUsers(text.trim());
                setContactResults(results.filter((r) => r.uid !== user?.uid));
            } catch (err) {
                console.error('Contact search error:', err);
                Alert.alert('Search failed', err.message);
            } finally { setContactSearching(false); }
        }, 400);
    };

    const addContact = async (contact) => {
        if (currentContacts.find((c) => c.uid === contact.uid)) {
            Alert.alert('Already added', `${contact.name || contact.email} is already an emergency contact.`);
            return;
        }
        const updated = [...currentContacts, { uid: contact.uid, name: contact.name, email: contact.email }];
        await saveField('emergencyContacts', updated);
        setContactSearch('');
        setContactResults([]);
    };

    const removeContact = (uid) => {
        Alert.alert('Remove contact', 'Remove this emergency contact?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive',
                onPress: async () => {
                    const updated = currentContacts.filter((c) => c.uid !== uid);
                    await saveField('emergencyContacts', updated);
                },
            },
        ]);
    };

    // ── Location sharing people ───────────────────────────────────────────────
    const currentSharingPeople = profile?.locationSharingWith || [];

    const handleShareSearch = (text) => {
        setShareSearch(text);
        clearTimeout(shareSearchTimer.current);
        if (text.trim().length < 2) { setShareResults([]); return; }
        shareSearchTimer.current = setTimeout(async () => {
            setShareSearching(true);
            try {
                const results = await searchAppUsers(text.trim());
                setShareResults(results.filter((r) => r.uid !== user?.uid));
            } catch (err) {
                console.error('Share search error:', err);
                Alert.alert('Search failed', err.message);
            } finally { setShareSearching(false); }
        }, 400);
    };

    const addSharingPerson = async (person) => {
        if (currentSharingPeople.find((p) => p.uid === person.uid)) {
            Alert.alert('Already added', `${person.name || person.email} is already in your sharing list.`);
            return;
        }
        const updated = [...currentSharingPeople, { uid: person.uid, name: person.name, email: person.email }];
        await saveField('locationSharingWith', updated);
        setShareSearch('');
        setShareResults([]);
    };

    const removeSharingPerson = (uid) => {
        Alert.alert('Remove person', 'Stop sharing location with this person?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive',
                onPress: async () => {
                    const updated = currentSharingPeople.filter((p) => p.uid !== uid);
                    await saveField('locationSharingWith', updated);
                },
            },
        ]);
    };

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout', style: 'destructive',
                onPress: async () => { await logout(); router.replace('/auth/login'); },
            },
        ]);
    };

    const displayProfile = profile || userProfile;

    return (
        <View style={styles.container}>
            {/* Header */}
            <LinearGradient colors={['#1B5E20', '#2E7D32', '#388E3C']} style={styles.header}>
                <View style={styles.avatarWrap}>
                    <View style={styles.avatar}>
                        <Ionicons name="person" size={44} color="#fff" />
                    </View>
                </View>
                <Text style={styles.userName}>{displayProfile?.name || 'Traveller'}</Text>
                <Text style={styles.userEmail}>{displayProfile?.email || user?.email}</Text>
                {displayProfile?.country && (
                    <View style={styles.countryBadge}>
                        <Ionicons name="location" size={13} color="#fff" />
                        <Text style={styles.countryText}>{displayProfile.country}</Text>
                    </View>
                )}
            </LinearGradient>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* ── MEDICAL DETAILS ── */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionTitleRow}>
                            <Ionicons name="medical-outline" size={20} color={Colors.danger} />
                            <Text style={styles.sectionTitle}>Medical Details</Text>
                        </View>
                        <TouchableOpacity style={styles.editBtn} onPress={() => setMedModal(true)}>
                            <Ionicons name="pencil-outline" size={15} color={Colors.primary} />
                            <Text style={styles.editBtnText}>Edit</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.sectionDesc}>
                        Shown to emergency contacts and nearby users when you send an SOS alert.
                    </Text>

                    {profile?.medicalDetails && Object.values(profile.medicalDetails).some(Boolean) ? (
                        <View style={styles.medCard}>
                            {profile.medicalDetails.bloodType ? (
                                <View style={styles.medRow}>
                                    <View style={styles.medBadge}>
                                        <Text style={styles.medBadgeText}>{profile.medicalDetails.bloodType}</Text>
                                    </View>
                                    <Text style={styles.medLabel}>Blood Type</Text>
                                </View>
                            ) : null}
                            {[
                                { key: 'allergies', label: 'Allergies', icon: 'warning-outline', color: Colors.warning },
                                { key: 'conditions', label: 'Medical Conditions', icon: 'fitness-outline', color: Colors.danger },
                                { key: 'medications', label: 'Medications', icon: 'medkit-outline', color: Colors.accent },
                                { key: 'emergencyNotes', label: 'Emergency Notes', icon: 'document-text-outline', color: '#555' },
                            ].map(({ key, label, icon, color }) =>
                                profile.medicalDetails[key] ? (
                                    <View key={key} style={styles.medInfoRow}>
                                        <Ionicons name={icon} size={15} color={color} style={{ marginTop: 1 }} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.medInfoLabel}>{label}</Text>
                                            <Text style={styles.medInfoValue}>{profile.medicalDetails[key]}</Text>
                                        </View>
                                    </View>
                                ) : null
                            )}
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.emptyCard} onPress={() => setMedModal(true)}>
                            <Ionicons name="add-circle-outline" size={28} color={Colors.textSecondary} />
                            <Text style={styles.emptyCardText}>Add medical details</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* ── EMERGENCY CONTACTS ── */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionTitleRow}>
                            <Ionicons name="people-outline" size={20} color={Colors.danger} />
                            <Text style={styles.sectionTitle}>Emergency Contacts</Text>
                        </View>
                        <TouchableOpacity style={styles.editBtn} onPress={() => setContactsModal(true)}>
                            <Ionicons name="add-outline" size={15} color={Colors.primary} />
                            <Text style={styles.editBtnText}>Add</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.sectionDesc}>
                        These people are immediately notified when you send an SOS, regardless of proximity.
                    </Text>

                    {currentContacts.length === 0 ? (
                        <TouchableOpacity style={styles.emptyCard} onPress={() => setContactsModal(true)}>
                            <Ionicons name="person-add-outline" size={28} color={Colors.textSecondary} />
                            <Text style={styles.emptyCardText}>Add emergency contacts</Text>
                        </TouchableOpacity>
                    ) : (
                        currentContacts.map((contact) => (
                            <View key={contact.uid} style={styles.personRow}>
                                <View style={styles.personAvatar}>
                                    <Ionicons name="person" size={18} color={Colors.danger} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.personName}>{contact.name || 'Unknown'}</Text>
                                    <Text style={styles.personEmail}>{contact.email}</Text>
                                </View>
                                <TouchableOpacity onPress={() => removeContact(contact.uid)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Ionicons name="close-circle-outline" size={22} color={Colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        ))
                    )}
                </View>

                {/* ── LOCATION SHARING ── */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionTitleRow}>
                            <Ionicons name="location-outline" size={20} color={Colors.accent} />
                            <Text style={styles.sectionTitle}>Location Sharing</Text>
                        </View>
                        <TouchableOpacity style={styles.editBtn} onPress={() => setSharingModal(true)}>
                            <Ionicons name="add-outline" size={15} color={Colors.primary} />
                            <Text style={styles.editBtnText}>Add</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.sectionDesc}>
                        When you share your location, these people can see it on the Friends Map.
                    </Text>

                    {currentSharingPeople.length === 0 ? (
                        <TouchableOpacity style={styles.emptyCard} onPress={() => setSharingModal(true)}>
                            <Ionicons name="person-add-outline" size={28} color={Colors.textSecondary} />
                            <Text style={styles.emptyCardText}>Add people to share location with</Text>
                        </TouchableOpacity>
                    ) : (
                        currentSharingPeople.map((person) => (
                            <View key={person.uid} style={styles.personRow}>
                                <View style={[styles.personAvatar, { backgroundColor: Colors.accent + '20' }]}>
                                    <Ionicons name="person" size={18} color={Colors.accent} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.personName}>{person.name || 'Unknown'}</Text>
                                    <Text style={styles.personEmail}>{person.email}</Text>
                                </View>
                                <TouchableOpacity onPress={() => removeSharingPerson(person.uid)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Ionicons name="close-circle-outline" size={22} color={Colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        ))
                    )}
                </View>

                {/* Logout */}
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* ── MEDICAL MODAL ── */}
            <Modal visible={medModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Medical Details</Text>
                            <TouchableOpacity onPress={() => setMedModal(false)}>
                                <Ionicons name="close" size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Blood type */}
                            <Text style={styles.fieldLabel}>Blood Type</Text>
                            <View style={styles.bloodTypeGrid}>
                                {BLOOD_TYPES.map((bt) => (
                                    <TouchableOpacity
                                        key={bt}
                                        style={[styles.bloodTypeBtn, med.bloodType === bt && styles.bloodTypeBtnActive]}
                                        onPress={() => setMed((p) => ({ ...p, bloodType: bt }))}
                                    >
                                        <Text style={[styles.bloodTypeBtnText, med.bloodType === bt && styles.bloodTypeBtnTextActive]}>
                                            {bt}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {[
                                { key: 'allergies', label: 'Allergies', placeholder: 'e.g. Penicillin, Peanuts', multiline: true },
                                { key: 'conditions', label: 'Medical Conditions', placeholder: 'e.g. Diabetes, Asthma', multiline: true },
                                { key: 'medications', label: 'Current Medications', placeholder: 'e.g. Metformin 500mg', multiline: true },
                                { key: 'emergencyNotes', label: 'Emergency Notes', placeholder: 'Any other info for first responders', multiline: true },
                            ].map(({ key, label, placeholder, multiline }) => (
                                <View key={key} style={{ marginBottom: 14 }}>
                                    <Text style={styles.fieldLabel}>{label}</Text>
                                    <TextInput
                                        style={[styles.fieldInput, multiline && { height: 72, textAlignVertical: 'top' }]}
                                        value={med[key]}
                                        onChangeText={(v) => setMed((p) => ({ ...p, [key]: v }))}
                                        placeholder={placeholder}
                                        placeholderTextColor="#bbb"
                                        multiline={multiline}
                                    />
                                </View>
                            ))}

                            <TouchableOpacity
                                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                                onPress={saveMedical}
                                disabled={saving}
                            >
                                {saving
                                    ? <ActivityIndicator color="#fff" />
                                    : <Text style={styles.saveBtnText}>Save Medical Details</Text>}
                            </TouchableOpacity>
                            <View style={{ height: 32 }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ── EMERGENCY CONTACTS MODAL ── */}
            <Modal visible={contactsModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Emergency Contact</Text>
                            <TouchableOpacity onPress={() => { setContactsModal(false); setContactSearch(''); setContactResults([]); }}>
                                <Ionicons name="close" size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchWrap}>
                            <Ionicons name="search" size={16} color="#999" />
                            <TextInput
                                style={styles.searchInput}
                                value={contactSearch}
                                onChangeText={handleContactSearch}
                                placeholder="Search by name or email..."
                                placeholderTextColor="#bbb"
                                autoFocus
                            />
                            {contactSearching && <ActivityIndicator size="small" color={Colors.primary} />}
                        </View>

                        <ScrollView>
                            {contactResults.map((r) => (
                                <TouchableOpacity key={r.uid} style={styles.searchResult} onPress={() => addContact(r)}>
                                    <View style={styles.resultAvatar}>
                                        <Ionicons name="person" size={18} color={Colors.danger} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.resultName}>{r.name || 'No name'}</Text>
                                        <Text style={styles.resultEmail}>{r.email}</Text>
                                    </View>
                                    <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
                                </TouchableOpacity>
                            ))}
                            {contactSearch.length > 1 && !contactSearching && contactResults.length === 0 && (
                                <Text style={styles.noResults}>No users found</Text>
                            )}

                            {/* Existing contacts listed in modal too */}
                            {currentContacts.length > 0 && (
                                <>
                                    <Text style={styles.subSectionLabel}>Current emergency contacts</Text>
                                    {currentContacts.map((c) => (
                                        <View key={c.uid} style={styles.searchResult}>
                                            <View style={styles.resultAvatar}>
                                                <Ionicons name="person" size={18} color={Colors.danger} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.resultName}>{c.name || 'Unknown'}</Text>
                                                <Text style={styles.resultEmail}>{c.email}</Text>
                                            </View>
                                            <TouchableOpacity onPress={() => removeContact(c.uid)}>
                                                <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </>
                            )}
                            <View style={{ height: 32 }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ── LOCATION SHARING MODAL ── */}
            <Modal visible={sharingModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Share Location With</Text>
                            <TouchableOpacity onPress={() => { setSharingModal(false); setShareSearch(''); setShareResults([]); }}>
                                <Ionicons name="close" size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchWrap}>
                            <Ionicons name="search" size={16} color="#999" />
                            <TextInput
                                style={styles.searchInput}
                                value={shareSearch}
                                onChangeText={handleShareSearch}
                                placeholder="Search by name or email..."
                                placeholderTextColor="#bbb"
                                autoFocus
                            />
                            {shareSearching && <ActivityIndicator size="small" color={Colors.accent} />}
                        </View>

                        <ScrollView>
                            {shareResults.map((r) => (
                                <TouchableOpacity key={r.uid} style={styles.searchResult} onPress={() => addSharingPerson(r)}>
                                    <View style={[styles.resultAvatar, { backgroundColor: Colors.accent + '20' }]}>
                                        <Ionicons name="person" size={18} color={Colors.accent} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.resultName}>{r.name || 'No name'}</Text>
                                        <Text style={styles.resultEmail}>{r.email}</Text>
                                    </View>
                                    <Ionicons name="add-circle-outline" size={22} color={Colors.accent} />
                                </TouchableOpacity>
                            ))}
                            {shareSearch.length > 1 && !shareSearching && shareResults.length === 0 && (
                                <Text style={styles.noResults}>No users found</Text>
                            )}

                            {currentSharingPeople.length > 0 && (
                                <>
                                    <Text style={styles.subSectionLabel}>Currently sharing with</Text>
                                    {currentSharingPeople.map((p) => (
                                        <View key={p.uid} style={styles.searchResult}>
                                            <View style={[styles.resultAvatar, { backgroundColor: Colors.accent + '20' }]}>
                                                <Ionicons name="person" size={18} color={Colors.accent} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.resultName}>{p.name || 'Unknown'}</Text>
                                                <Text style={styles.resultEmail}>{p.email}</Text>
                                            </View>
                                            <TouchableOpacity onPress={() => removeSharingPerson(p.uid)}>
                                                <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </>
                            )}
                            <View style={{ height: 32 }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F5' },

    // Header
    header: { paddingTop: 56, paddingBottom: 28, alignItems: 'center' },
    avatarWrap: { marginBottom: 12 },
    avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
    userName: { fontSize: 22, fontWeight: '800', color: '#fff' },
    userEmail: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 3 },
    countryBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    countryText: { fontSize: 12, color: '#fff' },

    // Scroll
    scroll: { flex: 1 },
    scrollContent: { padding: 16 },

    // Section
    section: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#222' },
    sectionDesc: { fontSize: 12, color: Colors.textSecondary, marginBottom: 14, lineHeight: 17 },
    editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: Colors.primary + '12' },
    editBtnText: { fontSize: 12, fontWeight: '600', color: Colors.primary },

    // Medical card
    medCard: { backgroundColor: '#FAFAFA', borderRadius: 10, padding: 12, gap: 10 },
    medRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    medBadge: { backgroundColor: Colors.danger, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    medBadgeText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    medLabel: { fontSize: 13, color: '#555' },
    medInfoRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    medInfoLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600', marginBottom: 1 },
    medInfoValue: { fontSize: 13, color: '#333' },

    // Person rows
    personRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 10 },
    personAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.danger + '15', justifyContent: 'center', alignItems: 'center' },
    personName: { fontSize: 14, fontWeight: '600', color: '#222' },
    personEmail: { fontSize: 12, color: Colors.textSecondary },

    // Empty card
    emptyCard: { alignItems: 'center', paddingVertical: 20, gap: 8, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, borderStyle: 'dashed' },
    emptyCardText: { fontSize: 13, color: Colors.textSecondary },

    // Logout
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1.5, borderColor: Colors.danger + '50' },
    logoutText: { fontSize: 15, fontWeight: '700', color: Colors.danger },

    // Modal
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
    modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', paddingTop: 10, paddingHorizontal: 20 },
    modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginBottom: 14 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 17, fontWeight: '700', color: '#222' },

    // Medical form
    fieldLabel: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 7, marginTop: 4 },
    fieldInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: '#222', backgroundColor: '#FAFAFA' },
    bloodTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    bloodTypeBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.border },
    bloodTypeBtnActive: { backgroundColor: Colors.danger, borderColor: Colors.danger },
    bloodTypeBtnText: { fontSize: 13, fontWeight: '600', color: Colors.text },
    bloodTypeBtnTextActive: { color: '#fff' },
    saveBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
    saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

    // Search
    searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
    searchInput: { flex: 1, fontSize: 14, color: '#222' },
    searchResult: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 10 },
    resultAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.danger + '15', justifyContent: 'center', alignItems: 'center' },
    resultName: { fontSize: 14, fontWeight: '600', color: '#222' },
    resultEmail: { fontSize: 12, color: Colors.textSecondary },
    noResults: { textAlign: 'center', color: Colors.textSecondary, paddingVertical: 24, fontSize: 14 },
    subSectionLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, paddingTop: 16, paddingBottom: 4 },
});