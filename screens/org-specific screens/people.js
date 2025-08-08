// screens/org-specific screens/PeopleScreen.js
import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Keyboard,
  InputAccessoryView,
  Platform,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const API_BASE = 'https://api.worshipbuddy.org/schedulebuddy/organizations';
const accessoryID = 'peopleDoneAccessory';

function normalizeEmail(e = '') {
  return String(e).toLowerCase().trim();
}

function PersonCard({ person, canEdit, onEdit, org, isOwner, isOrgAdmin }) {
  const positionCount = person.positions?.length || 0;
  const positionNames = person.positions?.join(', ') || 'No positions assigned';
  const teamCount = person.team_permissions?.length || 0;
  const teamNames =
    person.team_permissions?.map((tp) => tp.team_name).join(', ') ||
    'No teams assigned';

  let roleBadge = 'Member';
  let badgeColor = '#10b981'; // green
  const isPending = false; // supply logic if needed
  if (person.email && org?.owner?.email && person.email.toLowerCase() === org.owner.email.toLowerCase()) {
    roleBadge = 'Owner';
    badgeColor = '#f59e0b';
  } else if (person.org_admin) {
    roleBadge = 'Admin';
    badgeColor = '#ef4444';
  } else if (isPending) {
    roleBadge = 'Pending';
    badgeColor = '#facc15';
  }

  return (
    <TouchableOpacity
      activeOpacity={canEdit ? 0.7 : 1}
      style={[styles.personCard, !canEdit && { opacity: 0.6 }]}
      onPress={() => {
        if (canEdit) onEdit(person);
      }}
    >
      <View style={styles.personCardHeader}>
        <View style={[styles.personBadge, { backgroundColor: badgeColor }]}>
          <Ionicons name="person-outline" size={14} color="#fff" />
          <Text style={styles.personBadgeText}>{roleBadge}</Text>
        </View>
        <Text style={styles.personTitle}>
          {person.first_name} {person.last_name}
        </Text>
      </View>

      <View style={styles.personDetails}>
        <View style={styles.personDetailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="mail-outline" size={20} />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailPrimary}>Email</Text>
            <Text style={styles.detailSecondary}>{person.email}</Text>
          </View>
        </View>

        <View style={styles.personDetailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="briefcase-outline" size={20} />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailPrimary}>
              Positions ({positionCount})
            </Text>
            <Text style={styles.detailSecondary}>{positionNames}</Text>
          </View>
        </View>

        <View style={styles.personDetailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="people-outline" size={20} />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailPrimary}>Teams ({teamCount})</Text>
            <Text style={styles.detailSecondary}>{teamNames}</Text>
          </View>
        </View>

        {person.phone ? (
          <View style={styles.personDetailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="call-outline" size={20} />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailPrimary}>Phone</Text>
              <Text style={styles.detailSecondary}>{person.phone}</Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.personCardFooter}>
        <View style={styles.editHintContainer}>
          {canEdit ? (
            <Text style={styles.editHint}>Tap to edit</Text>
          ) : (
            <Text style={[styles.editHint, { fontStyle: 'normal' }]}>
              Read only
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// lightweight single-select dropdown to avoid native Picker
function TeamPermissionDropdown({ value, onChange, disabled }) {
  const options = ['', 'Viewer', 'Scheduler', 'Admin'];
  const [open, setOpen] = useState(false);
  const toggle = () => {
    if (disabled) return;
    setOpen((o) => !o);
  };

  return (
    <View style={{ position: 'relative' }}>
      <TouchableOpacity
        style={[dropdownStyles.button, disabled && { opacity: 0.6 }]}
        onPress={toggle}
        activeOpacity={0.7}
      >
        <Text style={dropdownStyles.buttonText}>{value || '—'}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} />
      </TouchableOpacity>
      {open && (
        <View style={dropdownStyles.menu}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => {
                onChange(opt);
                setOpen(false);
              }}
              style={dropdownStyles.item}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  dropdownStyles.itemText,
                  opt === value && { fontWeight: '700' },
                ]}
              >
                {opt || '—'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function PeopleScreen({ orgId }) {
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [permissions, setPermissions] = useState({
    isOwner: false,
    isOrgAdmin: false,
    userTeamPermissions: [],
  });
  const [showEditPerson, setShowEditPerson] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null); // null means "add new"
  const [allTeams, setAllTeams] = useState([]);
  const [allPositions, setAllPositions] = useState([]);
  const [formState, setFormState] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    org_admin: false,
    positions: [],
    team_permissions: [],
  });
  const [formMessage, setFormMessage] = useState({ text: '', type: 'info' });
  const [submitting, setSubmitting] = useState(false);

  const canEditAny = useMemo(
    () => permissions.isOwner || permissions.isOrgAdmin,
    [permissions]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      try {
        const storedEmail = await AsyncStorage.getItem('userEmail');
        if (!storedEmail || !orgId) {
          if (!cancelled) setLoading(false);
          return;
        }

        const email = normalizeEmail(storedEmail);
        const [orgRes, usersRes, teamsRes] = await Promise.all([
          fetch(`${API_BASE}/${orgId}`),
          fetch(`${API_BASE}/${orgId}/users`),
          fetch(`${API_BASE}/${orgId}/teams`),
        ]);

        if (!orgRes.ok || !usersRes.ok || !teamsRes.ok) {
          throw new Error('Failed to fetch initial data');
        }

        const [orgJson, usersJson, teamsJson] = await Promise.all([
          orgRes.json(),
          usersRes.json(),
          teamsRes.json(),
        ]);

        if (cancelled) return;

        setOrg(orgJson);
        setAllUsers(usersJson);
        setAllTeams(teamsJson);

        const uniquePositions = [
          ...new Set(
            teamsJson.flatMap((team) =>
              team.positions?.map((p) => p.position_name) || []
            )
          ),
        ];
        setAllPositions(uniquePositions);

        const user = usersJson.find(
          (u) => normalizeEmail(u.email) === email
        );
        setCurrentUser(user || null);

        const isOwner =
          normalizeEmail(orgJson.owner?.email) === email;
        const isOrgAdmin = !!user?.org_admin;
        const userTeamPermissions = user?.team_permissions || [];

        setPermissions({ isOwner, isOrgAdmin, userTeamPermissions });
      } catch (err) {
        console.warn('Failed to load people screen data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const togglePosition = (positionName) => {
    setFormState((s) => {
      const has = (s.positions || []).includes(positionName);
      const updated = has
        ? (s.positions || []).filter((p) => p !== positionName)
        : [...(s.positions || []), positionName];
      return { ...s, positions: updated };
    });
  };

  const onTeamPermissionChange = (teamName, permission) => {
    setFormState((s) => {
      const existing = s.team_permissions || [];
      const others = existing.filter((tp) => tp.team_name !== teamName);
      return { ...s, team_permissions: [...others, { team_name: teamName, permission }] };
    });
  };

  const openEdit = (person) => {
    setEditingPerson(person);
    const incoming = person.team_permissions || [];
    const mapped = (allTeams || []).map((team) => {
      const userEntry = incoming.find((tp) => tp.team_name === team.team_name);
      const permission = userEntry?.permissions?.[0] || '';
      return { team_name: team.team_name, permission };
    });

    setFormState({
      email: person.email,
      first_name: person.first_name || '',
      last_name: person.last_name || '',
      phone: person.phone || '',
      org_admin: !!person.org_admin,
      positions: person.positions || [],
      team_permissions: mapped,
    });
    setFormMessage({ text: '', type: 'info' });
    setShowEditPerson(true);
  };

  const openAdd = () => {
    setEditingPerson(null);
    setFormState({
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      org_admin: false,
      positions: [],
      team_permissions: (allTeams || []).map((t) => ({ team_name: t.team_name, permission: '' })),
    });
    setFormMessage({ text: '', type: 'info' });
    setShowEditPerson(true);
  };

  const handleUpdatePerson = async () => {
    if (!editingPerson) return;
    setSubmitting(true);
    setFormMessage({ text: 'Updating...', type: 'info' });
    try {
      const team_permissions_payload = (formState.team_permissions || [])
        .filter((tp) => tp.permission)
        .map((tp) => ({
          team_name: tp.team_name,
          permissions: [tp.permission],
        }));

      const payload = {
        email: formState.email,
        first_name: formState.first_name,
        last_name: formState.last_name,
        phone: formState.phone,
        org_admin: formState.org_admin,
        positions: formState.positions || [],
        team_permissions: team_permissions_payload,
      };
      const res = await fetch(
        `${API_BASE}/${orgId}/users/${encodeURIComponent(editingPerson.email)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Failed to update person.');
      }
      setFormMessage({ text: 'Person updated successfully!', type: 'success' });
      setTimeout(() => {
        setShowEditPerson(false);
        fetch(`${API_BASE}/${orgId}/users`)
          .then((r) => r.json())
          .then((u) => setAllUsers(u))
          .catch(() => {});
      }, 800);
    } catch (err) {
      setFormMessage({ text: err.message || 'Update failed.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

const handleAddPerson = async () => {
  setSubmitting(true);
  setFormMessage({ text: 'Adding person...', type: 'info' });
  if (!formState.email || !formState.first_name || !formState.last_name) {
    setFormMessage({ text: 'Email, first name, and last name are required.', type: 'error' });
    setSubmitting(false);
    return;
  }
  try {
    const personObj = {
      email: formState.email.trim(),
      first_name: formState.first_name.trim(),
      last_name: formState.last_name.trim(),
    };
    const res = await fetch(`${API_BASE}/${orgId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([personObj]),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || 'Failed to add person.');
    }
    setFormMessage({ text: 'Person invited successfully!', type: 'success' });
    setTimeout(() => {
      setShowEditPerson(false);
      fetch(`${API_BASE}/${orgId}/users`)
        .then((r) => r.json())
        .then((u) => setAllUsers(u))
        .catch(() => {});
    }, 800);
  } catch (err) {
    setFormMessage({ text: err.message || 'Add failed.', type: 'error' });
  } finally {
    setSubmitting(false);
  }
};

  const handleDeletePerson = async () => {
    if (!editingPerson) return;
    Alert.alert(
      'Delete person',
      `Are you sure you want to delete "${editingPerson.first_name} ${editingPerson.last_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setSubmitting(true);
              const res = await fetch(
                `${API_BASE}/${orgId}/users/${encodeURIComponent(editingPerson.email)}`,
                { method: 'DELETE' }
              );
              if (!res.ok) throw new Error('Failed to delete person.');
              setFormMessage({ text: 'Person deleted.', type: 'success' });
              setTimeout(() => {
                setShowEditPerson(false);
                fetch(`${API_BASE}/${orgId}/users`)
                  .then((r) => r.json())
                  .then((u) => setAllUsers(u))
                  .catch(() => {});
              }, 800);
            } catch (err) {
              setFormMessage({ text: err.message || 'Delete failed.', type: 'error' });
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleTransferOwnership = async () => {
    if (!editingPerson) return;
    Alert.alert(
      'Transfer ownership',
      `Transfer ownership to ${editingPerson.first_name} ${editingPerson.last_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          onPress: async () => {
            try {
              setSubmitting(true);
              const payload = {
                owner: {
                  first_name: editingPerson.first_name,
                  last_name: editingPerson.last_name,
                  email: editingPerson.email,
                },
              };
              const res = await fetch(`${API_BASE}/${orgId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              if (!res.ok) throw new Error('Failed to transfer ownership.');
              setFormMessage({ text: 'Ownership transferred!', type: 'success' });
              setTimeout(() => {
                setShowEditPerson(false);
                fetch(`${API_BASE}/${orgId}`)
                  .then((r) => r.json())
                  .then((o) => setOrg(o))
                  .catch(() => {});
              }, 800);
            } catch (err) {
              setFormMessage({ text: err.message || 'Transfer failed.', type: 'error' });
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const canEdit = (person) => {
    if (permissions.isOwner || permissions.isOrgAdmin) return true;
    return false;
  };

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>People</Text>
        {canEditAny && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={openAdd}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addButtonText}>Add Person</Text>
          </TouchableOpacity>
        )}
      </View>

      {allUsers.length === 0 ? (
        <Text style={styles.message}>No people found.</Text>
      ) : (
        <FlatList
          data={allUsers}
          keyExtractor={(item) => item.email}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <PersonCard
              person={item}
              canEdit={canEdit(item)}
              onEdit={openEdit}
              org={org}
              isOwner={permissions.isOwner}
              isOrgAdmin={permissions.isOrgAdmin}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}

      <Modal
        visible={showEditPerson}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!submitting) setShowEditPerson(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingPerson ? 'Edit Person' : 'Add Person'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (!submitting) setShowEditPerson(false);
                }}
              >
                <Ionicons name="close" size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={formState.email}
                onChangeText={(text) =>
                  setFormState((s) => ({ ...s, email: text }))
                }
                style={styles.input}
                editable={!submitting}
                placeholder="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                inputAccessoryViewID={accessoryID}
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                value={formState.first_name}
                onChangeText={(text) =>
                  setFormState((s) => ({ ...s, first_name: text }))
                }
                style={styles.input}
                editable={!submitting}
                placeholder="First name"
                inputAccessoryViewID={accessoryID}
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                value={formState.last_name}
                onChangeText={(text) =>
                  setFormState((s) => ({ ...s, last_name: text }))
                }
                style={styles.input}
                editable={!submitting}
                placeholder="Last name"
                inputAccessoryViewID={accessoryID}
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                value={formState.phone}
                onChangeText={(text) =>
                  setFormState((s) => ({ ...s, phone: text }))
                }
                style={styles.input}
                editable={!submitting}
                placeholder="Phone"
                keyboardType="phone-pad"
                inputAccessoryViewID={accessoryID}
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Positions</Text>
              <View style={styles.positionsCheckboxContainer}>
                {allPositions.map((position) => {
                  const selected = formState.positions.includes(position);
                  return (
                    <TouchableOpacity
                      key={position}
                      style={[
                        styles.positionCheckboxRow,
                        selected && styles.positionCheckboxRowSelected,
                      ]}
                      onPress={() => togglePosition(position)}
                      activeOpacity={0.7}
                      disabled={submitting}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          selected && styles.checkboxChecked,
                        ]}
                      >
                        {selected && (
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        )}
                      </View>
                      <Text style={styles.positionCheckboxLabel}>{position}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Team Permissions</Text>
              {formState.team_permissions.map((tp, index) => (
                <View key={tp.team_name} style={styles.teamPermissionRow}>
                  <Text style={styles.teamName}>{tp.team_name}</Text>
                  <TeamPermissionDropdown
                    value={tp.permission}
                    onChange={(val) => onTeamPermissionChange(tp.team_name, val)}
                    disabled={submitting}
                  />
                </View>
              ))}
            </View>
            <View style={styles.formGroupRow}>
              <Text style={styles.label}>Org Admin</Text>
              <Switch
                value={formState.org_admin}
                onValueChange={(val) =>
                  setFormState((s) => ({ ...s, org_admin: val }))
                }
                disabled={submitting}
              />
            </View>



            {formMessage.text ? (
              <Text
                style={[
                  styles.formMessage,
                  formMessage.type === 'error' && { color: '#e53e3e' },
                  formMessage.type === 'success' && { color: '#10b981' },
                ]}
              >
                {formMessage.text}
              </Text>
            ) : null}

            <View style={styles.modalActions}>
              {editingPerson ? (
                <>
                  <TouchableOpacity
                    onPress={handleTransferOwnership}
                    disabled={submitting}
                    style={[styles.secondaryButton, { flex: 1, marginRight: 8 }]}
                  >
                    <Text style={styles.secondaryButtonText}>
                      Transfer
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleDeletePerson}
                    disabled={submitting}
                    style={[styles.secondaryButton, { flex: 1, marginHorizontal: 8 }]}
                  >
                    <Text style={styles.secondaryButtonText}>Delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleUpdatePerson}
                    disabled={submitting}
                    style={[styles.primaryEditButton, { flex: 1, marginLeft: 8 }]}
                  >
                    <Text style={styles.primaryButtonText}>Update</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  onPress={handleAddPerson}
                  disabled={submitting}
                  style={[styles.primaryEditButton, { flex: 1 }]}
                >
                  <Text style={styles.primaryButtonText}>Add Person</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>

      <InputAccessoryView nativeID={accessoryID}>
        <View style={styles.accessory}>
          <TouchableOpacity onPress={() => Keyboard.dismiss()}>
            <Text style={styles.accessoryText}>Done</Text>
          </TouchableOpacity>
        </View>
      </InputAccessoryView>
    </View>
  );
}

const dropdownStyles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    minWidth: 100,
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    gap: 6,
  },
  buttonText: {
    fontSize: 14,
    color: '#1a202c',
  },
  menu: {
    position: 'absolute',
    top: 38,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 100,
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 5,
  },
  item: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  itemText: {
    fontSize: 14,
    color: '#1a202c',
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, backgroundColor: '#f4f6f8' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: '600', color: '#1a202c' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10245c',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  addButtonText: { color: '#fff', fontWeight: '500', fontSize: 14 },
  message: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 16,
    color: '#4a5568',
  },
  personCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    flexDirection: 'column',
  },
  personCardHeader: { marginBottom: 12 },
  personBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 6,
    marginBottom: 6,
  },
  personBadgeText: { color: '#fff', fontSize: 12, fontWeight: '500', marginLeft: 4 },
  personTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a202c',
  },
  personDetails: { paddingVertical: 8 },
  personDetailRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  detailIcon: { width: 36, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  detailContent: { flex: 1 },
  detailPrimary: { fontWeight: '600', fontSize: 14, color: '#1a202c' },
  detailSecondary: { fontSize: 13, color: '#64748b', marginTop: 2 },
  personCardFooter: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  editHint: { fontSize: 12, color: '#94a3b8' },
  editHintContainer: { flex: 1 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 16,
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#10245c' },
  formGroup: { marginBottom: 12 },
  label: { fontWeight: '600', marginBottom: 6, color: '#2d3748' },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  formGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  formMessage: {
    marginTop: 8,
    fontSize: 14,
  },
  modalActions: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10245c',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  primaryButtonText: { color: '#fff', fontWeight: '500' },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#edf2f7',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontWeight: '600',
    color: '#4a5568',
  },

  accessory: {
    backgroundColor: '#f1f5f9',
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  accessoryText: {
    fontWeight: '600',
    fontSize: 16,
    color: '#10245c',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  primaryEditButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#10245c',
    flex: 1,
    alignItems: 'center',
  },
  positionsCheckboxContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  positionCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#f8f9fb',
  },
  positionCheckboxRowSelected: {
    borderColor: '#10245c',
    backgroundColor: '#e6ecfa',
  },
  positionCheckboxLabel: {
    marginLeft: 8,
    fontSize: 14,
    color: '#2d3748',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10245c',
    borderColor: '#10245c',
  },
  teamPermissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  teamName: {
    flex: 1,
    fontSize: 14,
    color: '#1a202c',
    marginRight: 12,
  },
});