import {appendToQueue, validateQueue, validatePlan} from './online-workflow.mjs';

export const DEFAULT_REPOSITORY = 'chuckdotexe/adaptive-workout-tracker';
export const FILES = {queue: 'completed.json', plan: 'next-week.json'};
export class GitHubError extends Error {
  constructor(status, rateLimited = false) {
    super(rateLimited ? 'GitHub API limit reached. Keep logging on this device and retry Finish later; reconnecting will not reset the limit.' : status === 401 ? 'GitHub sign-in expired or token is invalid.' : status === 403 ?
      'GitHub denied access. Edit the saved token: select adaptive-workout-tracker, set Contents to Read and write, and save. Then retry Finish.' :
      status === 404 ? 'GitHub repository, branch, or workflow files not found.' :
      `GitHub request failed (${status}). Retry without closing this tab.`);
    this.status = status;
  }
}
export class GitHubStore {
  constructor({repository = DEFAULT_REPOSITORY, branch = 'main', token = '', fetchImpl = globalThis.fetch, timeout = 20000} = {}) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !/^[\w./-]+$/.test(branch)) throw Error('Invalid GitHub repository or branch');
    this.root = `https://api.github.com/repos/${repository}`;
    this.branch = branch; this.token = token; this.fetch = fetchImpl.bind(globalThis); this.timeout = timeout;
  }
  async request(path, method = 'GET', body) {
    const headers = {Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (body) headers['Content-Type'] = 'application/json';
    const response = await this.fetch(this.root + path, {method, headers, cache: 'no-store',
      signal: AbortSignal.timeout(this.timeout), ...(body ? {body: JSON.stringify(body)} : {})});
    if (!response.ok) throw new GitHubError(response.status, response.status === 429 || response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0');
    return response.json();
  }
  async readFile(path, ref) {
    const file = await this.request(`/contents/${path}?ref=${encodeURIComponent(ref)}`);
    if (file.encoding !== 'base64' || typeof file.content !== 'string') throw Error('GitHub file too large or invalid');
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(file.content.replace(/\s/g, '')), c => c.charCodeAt(0))));
  }
  async snapshot(program) {
    const ref = await this.request(`/git/ref/heads/${this.branch}`);
    const head = ref.object.sha;
    const [queue, plan] = await Promise.all([this.readFile(FILES.queue, head), this.readFile(FILES.plan, head)]);
    return {head, queue: validateQueue(queue, program), plan: validatePlan(plan, program)};
  }
  async writeFiles(head, files, message) {
    if (!this.token) throw Error('Connect GitHub before submitting a workout.');
    const base = await this.request(`/git/commits/${head}`);
    const tree = await this.request('/git/trees', 'POST', {base_tree: base.tree.sha,
      tree: Object.entries(files).map(([path, value]) => ({path, mode: '100644', type: 'blob', content: JSON.stringify(value, null, 2) + '\n'}))});
    const commit = await this.request('/git/commits', 'POST', {message, tree: tree.sha, parents: [head]});
    // Never force: a concurrent submit or processor must be re-read and merged.
    await this.request(`/git/refs/heads/${this.branch}`, 'PATCH', {sha: commit.sha, force: false});
    return commit.sha;
  }
  async submit(session, program, attempts = 4) {
    if (!this.token) throw Error('Connect GitHub before submitting a workout.');
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const snapshot = await this.snapshot(program);
        const result = await appendToQueue(snapshot.queue, snapshot.plan, session, program);
        if (result.duplicate) return {...snapshot, duplicate: true};
        const head = await this.writeFiles(snapshot.head, {[FILES.queue]: result.queue}, `Queue workout ${session.id}`);
        return {...snapshot, head, queue: result.queue, duplicate: false};
      } catch (error) {
        // A lost response can follow a successful push. Same session ID makes retry safe.
        if (attempt === attempts - 1 || error instanceof GitHubError && ![409, 422, 500, 502, 503, 504].includes(error.status) || !(error instanceof GitHubError || error instanceof TypeError || ['TimeoutError','AbortError'].includes(error.name))) throw error;
        await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
      }
    }
  }
}
