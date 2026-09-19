/** Tiny reactive store + app state */
function createStore(initial) {
  let state = { ...initial };
  const subs = new Set();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
      subs.forEach((fn) => fn(state));
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export const authState = createStore({
  user: null,
  token: localStorage.getItem('accessToken') || null,
  checked: false,
});

export function isAuthenticated() {
  return !!authState.get().token;
}

export function setAuth({ user, token }) {
  authState.set({ user, token, checked: true });
  if (token) localStorage.setItem('accessToken', token);
  else localStorage.removeItem('accessToken');
}

export function clearAuth() {
  authState.set({ user: null, token: null, checked: true });
  localStorage.removeItem('accessToken');
}

export function getUsername() {
  return authState.get().user?.username || null;
}

export const marketCache = createStore({
  btcPrice: 0,
  btcChange: 0,
  candles: [],
});
