// screens/org-specific screens/TeamsScreen.js
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const API_BASE = 'https://api.worshipbuddy.org/schedulebuddy/organizations';

function normalizeEmail(e = '') {
  return String(e).toLowerCase().trim();
}

function TeamCard({ team, canEdit, userTeamPermissions, onEdit }) {
  const positionCount = team.positions?.length || 0;
  const positionNames =
    team.positions?.map(p => `${p.position_name} (${p.qty || 1})`).join(', ') ||
    'No positions defined';

  return (
    <TouchableOpacity
      activeOpacity={canEdit ? 0.7 : 1}
      style={[
        styles.teamCard,
        !canEdit && { opacity: 0.6, cursor: 'default' },
      ]}
      onPress={() => {
        if (canEdit) onEdit(team);
      }}
    >
      <View style={styles.teamCardHeader}>
        <View style={styles.teamBadge}>
          <Ionicons name="people-outline" size={14} color="#fff" />
          <Text style={styles.teamBadgeText}>Team</Text>
        </View>
        <Text style={styles.teamTitle}>{team.team_name}</Text>
      </View>

      <View style={styles.teamDetails}>
        <View style={styles.teamDetailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="grid-outline" size={20} />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailPrimary}>
              Positions ({positionCount})
            </Text>
            <Text style={styles.detailSecondary}>{positionNames}</Text>
          </View>
        </View>

        <View style={styles.teamDetailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="swap-horizontal-outline" size={20} />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailPrimary}>Assignment</Text>
            <Text style={styles.detailSecondary}>
              {team.assign_with_other_team
                ? 'Can be assigned with other teams'
                : 'Independent team'}
            </Text>
          </View>
        </View>

        {team.description ? (
          <View style={styles.teamDetailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="document-text-outline" size={20} />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailPrimary}>Description</Text>
              <Text style={styles.detailSecondary}>{team.description}</Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.teamCardFooter}>
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

function PositionRow({ position, onChange, onRemove }) {
  return (
    <View style={styles.positionRow}>
      <TextInput
        style={styles.positionInput}
        placeholder="Position name"
        value={position.position_name}
        onChangeText={text => onChange({ ...position, position_name: text })}
      />
      <TextInput
        style={styles.qtyInput}
        placeholder="Qty"
        keyboardType="number-pad"
        value={String(position.qty || 1)}
        onChangeText={text =>
          onChange({ ...position, qty: parseInt(text, 10) || 1 })
        }
      />
      <View style={styles.checkboxRow}>
        <TouchableOpacity
          onPress={() =>
            onChange({
              ...position,
              assign_with_other_position:
                !position.assign_with_other_position,
            })
          }
          style={styles.checkboxWrapper}
        >
          <View
            style={[
              styles.checkbox,
              position.assign_with_other_position && styles.checkboxChecked,
            ]}
          />
          <Text style={styles.checkboxLabel}>
            Allow assignment with other positions
          </Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
        <Text style={{ color: 'white' }}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function TeamsScreen({ orgId }) {
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [permissions, setPermissions] = useState({
    isOwner: false,
    isOrgAdmin: false,
    userTeamPermissions: [],
  });
  const [showCreateEdit, setShowCreateEdit] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [formState, setFormState] = useState({
    team_name: '',
    description: '',
    assign_with_other_team: false,
    positions: [
      {
        position_name: '',
        qty: 1,
        assign_with_other_position: false,
      },
    ],
  });
  const [formMessage, setFormMessage] = useState({ text: '', type: 'info' });
  const [submitting, setSubmitting] = useState(false);

  const normalizedUserEmail = useMemo(
    () => normalizeEmail(currentUser?.email || ''),
    [currentUser]
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
        setTeams(teamsJson);

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
        console.warn('Failed to load teams screen data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const canCreateTeam = useMemo(
    () => permissions.isOwner || permissions.isOrgAdmin,
    [permissions]
  );

  const userRolesByTeam = useMemo(() => {
    const map = {};
    permissions.userTeamPermissions?.forEach((tp) => {
      map[tp.team_name] = tp.permissions || [];
    });
    return map;
  }, [permissions]);

  const refreshTeams = async () => {
    try {
      const res = await fetch(`${API_BASE}/${orgId}/teams`);
      if (!res.ok) throw new Error('Failed to reload teams');
      const updated = await res.json();
      setTeams(updated);
    } catch (e) {
      console.warn(e);
    }
  };

  const openCreate = () => {
    setEditingTeam(null);
    setFormState({
      team_name: '',
      description: '',
      assign_with_other_team: false,
      positions: [
        {
          position_name: '',
          qty: 1,
          assign_with_other_position: false,
        },
      ],
    });
    setFormMessage({ text: '', type: 'info' });
    setShowCreateEdit(true);
  };

  const openEdit = (team) => {
    setEditingTeam(team);
    setFormState({
      team_name: team.team_name,
      description: team.description || '',
      assign_with_other_team: !!team.assign_with_other_team,
      positions:
        team.positions && team.positions.length
          ? team.positions.map((p) => ({
              position_name: p.position_name,
              qty: p.qty || 1,
              assign_with_other_position:
                !!p.assign_with_other_position,
            }))
          : [
              {
                position_name: '',
                qty: 1,
                assign_with_other_position: false,
              },
            ],
    });
    setFormMessage({ text: '', type: 'info' });
    setShowCreateEdit(true);
  };

  const hasEditAccessToTeam = (team) => {
    if (permissions.isOwner || permissions.isOrgAdmin) return true;
    const perms = userRolesByTeam[team.team_name] || [];
    return perms.includes('Admin');
  };

  const handleSubmit = async () => {
    if (!formState.team_name.trim()) {
      setFormMessage({ text: 'Team name is required.', type: 'error' });
      return;
    }
    if (
      !formState.positions.some(
        (p) => p.position_name && p.position_name.trim()
      )
    ) {
      setFormMessage({
        text: 'At least one position with a name is required.',
        type: 'error',
      });
      return;
    }

    setSubmitting(true);
    setFormMessage({ text: 'Submitting...', type: 'info' });

    try {
      // Check duplicate name when creating
      if (!editingTeam) {
        const existingRes = await fetch(`${API_BASE}/${orgId}/teams`);
        const existing = await existingRes.json();
        const duplicate = existing.some(
          (t) =>
            t.team_name.trim().toLowerCase() ===
            formState.team_name.trim().toLowerCase()
        );
        if (duplicate) {
          setFormMessage({
            text: 'A team with this name already exists.',
            type: 'error',
          });
          setSubmitting(false);
          return;
        }
      }

      const payload = {
        team_name: formState.team_name,
        description: formState.description,
        assign_with_other_team: formState.assign_with_other_team,
        positions: formState.positions.map((p) => ({
          position_name: p.position_name,
          qty: p.qty,
          assign_with_other_position: p.assign_with_other_position,
        })),
        ask_for_availability: false,
      };

      let res;
      if (editingTeam) {
        res = await fetch(
          `${API_BASE}/${orgId}/teams/${encodeURIComponent(
            editingTeam.team_name
          )}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );
      } else {
        res = await fetch(`${API_BASE}/${orgId}/teams`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to save team.');
      }

      setFormMessage({
        text: editingTeam
          ? 'Team updated successfully!'
          : 'Team created successfully!',
        type: 'success',
      });

      setTimeout(() => {
        setShowCreateEdit(false);
        refreshTeams();
      }, 800);
    } catch (err) {
      console.warn(err);
      setFormMessage({
        text: err.message || 'Unexpected error.',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingTeam) return;
    Alert.alert(
      'Delete team',
      `Are you sure you want to delete "${editingTeam.team_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setSubmitting(true);
              const res = await fetch(
                `${API_BASE}/${orgId}/teams/${encodeURIComponent(
                  editingTeam.team_name
                )}`,
                { method: 'DELETE' }
              );
              if (!res.ok) throw new Error('Failed to delete team.');
              setFormMessage({
                text: 'Team deleted successfully!',
                type: 'success',
              });
              setTimeout(() => {
                setShowCreateEdit(false);
                refreshTeams();
              }, 800);
            } catch (err) {
              setFormMessage({
                text: err.message || 'Delete failed.',
                type: 'error',
              });
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

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Teams</Text>
        {canCreateTeam && (
          <TouchableOpacity style={styles.primaryButton} onPress={openCreate}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.primaryButtonText}>Create Team</Text>
          </TouchableOpacity>
        )}
      </View>

      {teams.length === 0 ? (
        <Text style={styles.message}>
          No teams found. {canCreateTeam ? 'Create your first team.' : ''}
        </Text>
      ) : (
        <FlatList
          data={teams}
          keyExtractor={(item) => item.team_name}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <TeamCard
              team={item}
              canEdit={hasEditAccessToTeam(item)}
              userTeamPermissions={permissions.userTeamPermissions}
              onEdit={openEdit}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}

      <Modal
        visible={showCreateEdit}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!submitting) setShowCreateEdit(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingTeam ? 'Edit Team' : 'Create New Team'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (!submitting) setShowCreateEdit(false);
                }}
              >
                <Ionicons name="close" size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Team Name</Text>
              <TextInput
                value={formState.team_name}
                onChangeText={(text) =>
                  setFormState((s) => ({ ...s, team_name: text }))
                }
                style={styles.input}
                editable={!submitting}
                placeholder="Team name"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                value={formState.description}
                onChangeText={(text) =>
                  setFormState((s) => ({ ...s, description: text }))
                }
                style={[styles.input, { height: 80 }]}
                editable={!submitting}
                placeholder="Brief description"
                multiline
              />
            </View>

            <View style={styles.formGroupRow}>
              <TouchableOpacity
                onPress={() =>
                  setFormState((s) => ({
                    ...s,
                    assign_with_other_team: !s.assign_with_other_team,
                  }))
                }
                style={styles.checkboxWrapper}
              >
                <View
                  style={[
                    styles.checkbox,
                    formState.assign_with_other_team && styles.checkboxChecked,
                  ]}
                />
                <Text style={styles.checkboxLabel}>
                  Allow assignment with other teams
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.positionsContainer}>
              <Text style={[styles.label, { marginBottom: 8 }]}>
                Team Positions
              </Text>
              {formState.positions.map((pos, idx) => (
                <PositionRow
                  key={idx}
                  position={pos}
                  onChange={(updated) =>
                    setFormState((s) => {
                      const copy = { ...s };
                      copy.positions[idx] = updated;
                      return copy;
                    })
                  }
                  onRemove={() => {
                    setFormState((s) => {
                      if (s.positions.length === 1) return s; // keep at least one
                      const copy = { ...s };
                      copy.positions = copy.positions.filter(
                        (_, i) => i !== idx
                      );
                      return copy;
                    });
                  }}
                />
              ))}
              <TouchableOpacity
                onPress={() =>
                  setFormState((s) => ({
                    ...s,
                    positions: [
                      ...s.positions,
                      {
                        position_name: '',
                        qty: 1,
                        assign_with_other_position: false,
                      },
                    ],
                  }))
                }
                style={styles.addPositionBtn}
              >
                <Ionicons name="add" size={14} color="#fff" />
                <Text style={styles.addPositionText}>Add Position</Text>
              </TouchableOpacity>
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
            <TouchableOpacity
                onPress={handleDelete}
                disabled={!editingTeam || submitting}
                style={[
                styles.secondaryButton,
                editingTeam ? {} : styles.inactiveButton,
                { flex: 1, marginRight: 8 },
                ]}
            >
                <Text style={styles.secondaryButtonText}>Delete</Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => setShowCreateEdit(false)}
                disabled={submitting}
                style={[styles.secondaryButton, { flex: 1, marginHorizontal: 8 }]}
            >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting}
                style={[styles.primaryEditButton, { flex: 1, marginLeft: 8 }]}
            >
                <Text style={styles.primaryButtonText}>
                {editingTeam ? 'Update' : 'Create'}
                </Text>
            </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, backgroundColor: '#f4f6f8' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: '600', color: '#1a202c' },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10245c',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  primaryButtonText: { color: '#fff', fontWeight: '500', marginLeft: 4 },
  message: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 16,
    color: '#4a5568',
  },

  teamCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    flexDirection: 'column',
  },
  teamCardHeader: {
    marginBottom: 12,
  },
  teamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10245c',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 6,
    marginBottom: 6,
  },
  teamBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  teamTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a202c',
  },
  teamDetails: {
    paddingVertical: 8,
  },
  teamDetailRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  detailIcon: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  detailContent: { flex: 1 },
  detailPrimary: {
    fontWeight: '600',
    fontSize: 14,
    color: '#1a202c',
  },
  detailSecondary: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  teamCardFooter: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  editHint: {
    fontSize: 12,
    color: '#94a3b8',
  },
  editHintContainer: { flex: 1 },

  // Modal
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
  },
  checkboxWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#10245c',
    borderColor: '#10245c',
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#2d3748',
    flexShrink: 1,
  },
  positionsContainer: {
    marginTop: 6,
    marginBottom: 6,
  },
  positionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
    backgroundColor: '#f8f9fb',
    padding: 10,
    borderRadius: 10,
  },
  positionInput: {
    flex: 1,
    minWidth: 100,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 8,
  },
  qtyInput: {
    width: 60,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 8,
  },
  removeBtn: {
    backgroundColor: '#ef4444',
    borderRadius: 16,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPositionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
    alignSelf: 'flex-start',
    gap: 6,
  },
  addPositionText: {
    color: '#fff',
    fontWeight: '500',
    marginLeft: 4,
  },
  formMessage: {
    marginTop: 8,
    fontSize: 14,
  },
  modalActions: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#edf2f7',
    flex: 1,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontWeight: '600',
    color: '#4a5568',
  },
  primaryEditButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#10245c',
    flex: 1,
    alignItems: 'center',
  },
});