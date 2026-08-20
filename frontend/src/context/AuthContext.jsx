import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

/**
 * AuthProvider — Production auth context.
 *
 * Storage strategy:
 *   - JWT token stored in localStorage under 'auth_token'
 *   - User profile cached in localStorage under 'user_profile' (rebuilt on each login/mount)
 *   - Credits & plan come from JWT payload + /api/auth/me on mount
 *   - On mount: validates stored token with /api/auth/me — auto-logs out if invalid/expired
 *
 * Credits:
 *   - Stored locally for instant UI (deductCredits updates local state)
 *   - Synced with server via /api/auth/update-credits after each deduction
 *   - History & assets stored in localStorage (per-user key based on user ID)
 */
export const AuthProvider = ({ children }) => {
  const getCachedProfile = () => {
    try {
      const cacheStr = localStorage.getItem('user_profile');
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        if (cache && (Date.now() - cache.timestamp < 300000)) {
          return cache;
        }
      }
    } catch (e) {
      console.warn("Failed to parse user profile cache:", e);
    }
    return null;
  };

  const cached = getCachedProfile();

  const [user, setUser] = useState(cached ? cached.user : null);
  const [credits, setCredits] = useState(cached ? cached.credits : 0);
  const [plan, setPlan] = useState(cached ? cached.plan : 'Explorer');
  const [history, setHistory] = useState([]);
  const [assets, setAssets] = useState({ datasets: [], extracted: [], generated: [] });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(!cached); // false if we have valid cache

  // ── Per-user localStorage keys ────────────────────────────────────────────
  const userKey = (uid, key) => `u_${uid}_${key}`;

  const loadUserLocalData = (uid) => {
    try {
      const h = localStorage.getItem(userKey(uid, 'history'));
      const a = localStorage.getItem(userKey(uid, 'assets'));
      setHistory(h ? JSON.parse(h) : []);
      setAssets(a ? JSON.parse(a) : { datasets: [], extracted: [], generated: [] });
    } catch {
      setHistory([]);
      setAssets({ datasets: [], extracted: [], generated: [] });
    }
  };

  const saveProfileCache = useCallback((u, cr, pl) => {
    try {
      const cacheData = {
        user: u,
        credits: cr,
        plan: pl,
        timestamp: Date.now()
      };
      localStorage.setItem('user_profile', JSON.stringify(cacheData));
    } catch (e) {
      console.warn("Failed to write user profile cache:", e);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_profile');
    setUser(null);
    setCredits(0);
    setPlan('Explorer');
    setHistory([]);
    setAssets({ datasets: [], extracted: [], generated: [] });
    setIsAuthModalOpen(false);
  }, []);

  // ── On mount: validate stored token with retry loop ──────────────────────
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setIsLoading(false);
      localStorage.removeItem('user_profile');
      return;
    }

    const currentCached = getCachedProfile();
    if (currentCached) {
      setUser(currentCached.user);
      setCredits(currentCached.credits);
      setPlan(currentCached.plan);
      loadUserLocalData(currentCached.user.id);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    let active = true;
    let delay = 500;
    let timerId = null;
    let retry500Count = 0;
    const max500Retries = 10;

    const verifyToken = () => {
      axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(({ data }) => {
          if (!active) return;
          const userData = {
            id: data.id,
            name: data.name,
            email: data.email,
            plan: data.plan,
            avatar: data.avatar,
          };
          setUser(userData);
          setCredits(data.credits);
          setPlan(data.plan);
          loadUserLocalData(data.id);
          saveProfileCache(userData, data.credits, data.plan);
          setIsLoading(false);
        })
        .catch((err) => {
          if (!active) return;
          const status = err?.response?.status;
          
          // 401/403/404 represents invalid credentials, token expired, or user not found/deleted
          if (status === 401 || status === 403 || status === 404) {
            console.warn(`[AUTH] Token verification rejected (${status}). Logging out.`);
            logout();
            setIsLoading(false);
            return;
          }
          
          // Network errors, ECONNREFUSED (no status code), or 503 Service Unavailable, or generic 500
          console.warn(`[AUTH] Token verification failed (${status || 'Network Error'}). Retrying in ${delay}ms...`);
          
          if (status === 500) {
            retry500Count++;
            if (retry500Count > max500Retries) {
              console.error("[AUTH] Persistent 500 error on token verification. Stopping retries.");
              logout();
              setIsLoading(false);
              return;
            }
          } else {
            retry500Count = 0;
          }

          // Retain loading state if we don't have a valid cached profile
          if (!currentCached) {
            setIsLoading(true);
          }
          
          // Schedule next retry with exponential backoff (max 5 seconds)
          timerId = setTimeout(() => {
            delay = Math.min(delay * 2, 5000);
            verifyToken();
          }, delay);
        });
    };

    verifyToken();

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [logout, saveProfileCache]);

  // ── Login (after successful API call from Login.jsx) ──────────────────────
  const login = useCallback((apiResponse) => {
    if (apiResponse?.token && apiResponse?.user) {
      const { token, user: u } = apiResponse;
      localStorage.setItem('auth_token', token);
      const userData = {
        id: u.id,
        name: u.name,
        email: u.email,
        plan: u.plan,
        avatar: u.avatar,
      };
      setUser(userData);
      setCredits(u.credits);
      setPlan(u.plan);
      loadUserLocalData(u.id);
      saveProfileCache(userData, u.credits, u.plan);
    } else {
      // Profile update path (called from Dashboard with partial data)
      setUser(prev => {
        const updated = { ...prev, ...apiResponse };
        saveProfileCache(updated, credits, plan);
        return updated;
      });
    }
  }, [credits, plan, saveProfileCache]);

  // ── Credits ───────────────────────────────────────────────────────────────
  const deductCredits = useCallback((amount, actionName = null, datasetName = null) => {
    if (credits >= amount) {
      const newCredits = credits - amount;
      setCredits(newCredits);
      if (user) {
        saveProfileCache(user, newCredits, plan);
      }

      // Sync with server (fire-and-forget — UI already updated)
      const token = localStorage.getItem('auth_token');
      if (token) {
        axios.post('/api/auth/update-credits', { amount }, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {
          // If sync fails, re-add credits back to keep consistency
          setCredits(credits);
          if (user) {
            saveProfileCache(user, credits, plan);
          }
        });
      }

      if (actionName && datasetName) {
        addHistory(actionName, datasetName, amount);
      }
      return true;
    }
    return false;
  }, [credits, user, plan, saveProfileCache]);

  // ── History (per-user localStorage) ──────────────────────────────────────
  const addHistory = useCallback((action, datasetName, cost) => {
    if (!user?.id) return;
    const newItem = {
      id: Date.now().toString(),
      dataset: datasetName,
      action,
      time: new Date().toISOString(),
      credits: cost,
    };
    setHistory(prev => {
      const updated = [newItem, ...prev].slice(0, 50);
      localStorage.setItem(userKey(user.id, 'history'), JSON.stringify(updated));
      return updated;
    });
  }, [user?.id]);

  // ── Assets (per-user localStorage) ───────────────────────────────────────
  const addAsset = useCallback((type, asset) => {
    if (!user?.id) return;
    const newAsset = { ...asset, id: Date.now().toString(), date: new Date().toISOString() };
    setAssets(prev => {
      const updated = { ...prev, [type]: [newAsset, ...(prev[type] || [])] };
      localStorage.setItem(userKey(user.id, 'assets'), JSON.stringify(updated));
      return updated;
    });
  }, [user?.id]);

  // ── Plan ──────────────────────────────────────────────────────────────────
  const updatePlan = useCallback((newPlan, newCredits) => {
    setPlan(newPlan);
    setCredits(newCredits);
    if (user) {
      saveProfileCache(user, newCredits, newPlan);
    }
  }, [user, saveProfileCache]);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    try {
      const { data } = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const userData = {
        id: data.id,
        name: data.name,
        email: data.email,
        plan: data.plan,
        avatar: data.avatar,
      };
      setUser(userData);
      setCredits(data.credits);
      setPlan(data.plan);
      loadUserLocalData(data.id);
      saveProfileCache(userData, data.credits, data.plan);
    } catch (err) {
      console.error("Failed to refresh user auth state:", err);
    }
  }, [saveProfileCache]);

  // ── Auth Modal ────────────────────────────────────────────────────────────
  const openAuthModal = useCallback(() => setIsAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => setIsAuthModalOpen(false), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        credits,
        plan,
        isLoading,
        login,
        logout,
        deductCredits,
        updatePlan,
        refreshUser,
        history,
        addHistory,
        assets,
        addAsset,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
