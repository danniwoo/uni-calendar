export function createController(api, onChange = () => {}) {
  let state = { session: null, accountId: null, access: null, board: null, busy: false, error: "", notice: "", checked: false, rejected: false };
  let generation = 0;
  let active = null;
  const emit = () => onChange({ ...state });
  const current = (version) => version === generation;

  function setSession(session) {
    const changed = (state.session?.user?.id ?? null) !== (session?.user?.id ?? null);
    if (changed) {
      generation += 1;
      active?.abort();
      active = null;
      state = { session, accountId: null, access: null, board: null, busy: false, error: "", notice: "", checked: false, rejected: false };
    } else state = { ...state, session };
    emit();
    return changed;
  }

  async function run(operation) {
    if (!state.session || state.busy || state.rejected) return;
    const version = generation;
    const session = state.session;
    const abort = new AbortController();
    active = abort;
    state = { ...state, busy: true, error: "", notice: "" };
    emit();
    try {
      const result = await operation(session, abort.signal);
      if (current(version)) state = { ...state, ...result };
    } catch (error) {
      if (current(version) && error.name !== "AbortError") {
        state = { ...state, error: error.message || "Connection failed. Try again." };
        if (error.status === 401) state = { ...state, board: null, accountId: null, access:null, checked: false, rejected: true };
      }
    } finally {
      if (current(version)) { active = null; state = { ...state, busy: false }; emit(); }
    }
  }

  async function read(session, signal) {
    const account = await api.session(session, signal);
    if(!account.access.enrolled)return {accountId:account.accountId,access:account.access,board:null,checked:true};
    let board = null;
    try { board = await api.get(session, signal); }
    catch (error) { if (error.status !== 404) throw error; }
    return { accountId: account.accountId, access:account.access,board, checked: true };
  }

  return {
    getState: () => ({ ...state }),
    setSession,
    // Invalidate outstanding work before calling the SDK's asynchronous signOut.
    clear: () => setSession(null),
    refresh: () => run(read),
    seed: () => run(async (session, signal) => {
      const account = await api.session(session, signal);
      if(!account.access.enrolled)return {accountId:account.accountId,access:account.access,board:null,checked:true};
      const board = await api.seed(session, signal);
      return { accountId: account.accountId,access:account.access,board, checked: true, notice: "Test semester loaded. Open the phone trial with this same Google account." };
    }),
    update: (taskId, completed) => {
      if (!state.board || !state.board.semester.tasks.some(task => task.id === taskId)) return Promise.resolve();
      const revision = state.board.revision;
      return run(async (session, signal) => {
        try { return { board: await api.update(session, taskId, completed, revision, signal), notice: "Saved to the test API. Refresh the phone trial to check the same change." }; }
        catch (error) {
          if (error.status !== 409) throw error;
          return { ...await read(session, signal), notice: "Changed on another device. The latest version is now shown; choose your change again if needed." };
        }
      });
    },
  };
}
