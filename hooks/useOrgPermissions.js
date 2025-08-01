// hooks/useOrgPermissions.js
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useOrgPermissions(orgId) {
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState({
    isOwner: false,
    isOrgAdmin: false,
    isScheduler: false,
    isTeamAdmin: false,
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPermissions() {
      try {
        const userEmail = (await AsyncStorage.getItem('userEmail') || '').toLowerCase().trim();
        if (!orgId || !userEmail) {
          if (!cancelled) {
            setPermissions(p => ({ ...p }));
            setLoading(false);
          }
          return;
        }

        const [orgRes, usersRes] = await Promise.all([
          fetch(`https://api.worshipbuddy.org/schedulebuddy/organizations/${orgId}`),
          fetch(`https://api.worshipbuddy.org/schedulebuddy/organizations/${orgId}/users`)
        ]);

        if (!orgRes.ok || !usersRes.ok) {
          throw new Error('Failed to fetch org or users');
        }

        const org = await orgRes.json();
        const users = await usersRes.json();

        const currentUser = users.find(u => u.email?.toLowerCase() === userEmail);
        const isOwner = (org.owner?.email?.toLowerCase() === userEmail);
        const isOrgAdmin = !!currentUser?.org_admin;
        const teamPerms = currentUser?.team_permissions || [];
        const flatPerms = teamPerms.flatMap(tp => tp.permissions || []);
        const isScheduler = flatPerms.includes('Scheduler');
        const isTeamAdmin = flatPerms.includes('Admin');

        if (!cancelled) {
          setPermissions({ isOwner, isOrgAdmin, isScheduler, isTeamAdmin });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPermissions();

    return () => {
      cancelled = true;
    };
  }, [orgId]);

  return { loading, permissions, error };
}