import {seedPlan} from '../../lib/online-workflow.mjs';
export class GitHubFixture {
  constructor(program) {
    this.head = 'head-0'; this.sequence = 0;
    this.commits = new Map([[this.head, {files: {'completed.json': {version:1,sessions:[]}, 'next-week.json':seedPlan(program)}}]]);
    this.trees = new Map(); this.failAfterPublish = false; this.rejectWrite = false; this.requests = [];
    this.fetch = this.fetch.bind(this);
  }
  get files() {return this.commits.get(this.head).files;}
  async fetch(url, options = {}) {
    const path = new URL(url).pathname.replace('/repos/chuckdotexe/adaptive-workout-tracker','');
    const method = options.method || 'GET';
    this.requests.push({path,method,headers:options.headers});
    const body = options.body ? JSON.parse(options.body) : null;
    const respond = (data, status=200) => new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
    if (method !== 'GET' && this.rejectWrite) return respond({},403);
    if (path === '/git/ref/heads/main') return respond({object:{sha:this.head}});
    if (path.startsWith('/contents/')) {
      const commit = this.commits.get(new URL(url).searchParams.get('ref'));
      const value = commit?.files[path.slice('/contents/'.length)];
      return value ? respond({encoding:'base64',content:Buffer.from(JSON.stringify(value)).toString('base64')}) : respond({},404);
    }
    if (method === 'GET' && path.startsWith('/git/commits/')) return respond({tree:{sha:path.split('/').at(-1)}});
    if (path === '/git/trees') {
      const id='tree-'+(++this.sequence);
      const files=structuredClone(this.commits.get(body.base_tree).files);
      for(const entry of body.tree) files[entry.path]=JSON.parse(entry.content);
      this.trees.set(id,files); return respond({sha:id});
    }
    if (path === '/git/commits') {
      const id='head-'+(++this.sequence);
      this.commits.set(id,{files:this.trees.get(body.tree),parent:body.parents[0]}); return respond({sha:id});
    }
    if (path === '/git/refs/heads/main') {
      if(body.force !== false || this.commits.get(body.sha).parent !== this.head) return respond({},422);
      this.head=body.sha;
      if(this.failAfterPublish){this.failAfterPublish=false;throw new TypeError('Connection lost after commit');}
      return respond({object:{sha:this.head}});
    }
    return respond({},404);
  }
}
