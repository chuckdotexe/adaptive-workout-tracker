const quote=title=>"'"+title.replaceAll("'","''")+"'";
export class GoogleSheetStore {
  constructor({spreadsheetId,token,fetchImpl=fetch}){this.id=spreadsheetId;this.token=token;this.fetch=fetchImpl;}
  static async connect(config){
    if(!process.env.GOOGLE_SERVICE_ACCOUNT_JSON)throw Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON. Queue preserved.');
    let credentials;
    try{credentials=JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);}catch{throw Error('Invalid Google service-account JSON.');}
    if(credentials.type!=='service_account')throw Error('A Google service-account credential is required.');
    const {GoogleAuth}=await import('google-auth-library');
    const auth=new GoogleAuth({credentials,scopes:['https://www.googleapis.com/auth/spreadsheets']});
    let result;
    try{const client=await auth.getClient();result=await client.getAccessToken();}catch{throw Error('Google authentication failed. Check the service-account credential and Sheets access.');}
    return new GoogleSheetStore({spreadsheetId:config.spreadsheetId,token:result.token});
  }
  async request(path,method='GET',body){
    const response=await this.fetch('https://sheets.googleapis.com/v4/spreadsheets/'+this.id+path,{method,headers:{Authorization:'Bearer '+this.token,'Content-Type':'application/json'},signal:AbortSignal.timeout(30000),...(body?{body:JSON.stringify(body)}:{})});
    // Never echo Google responses or input rows into public Actions logs.
    if(!response.ok)throw Error('Google Sheets request failed ('+response.status+'). Queue preserved.');
    return response.json();
  }
  async metadata(){return this.request('?fields=spreadsheetId,sheets.properties');}
  async read(title,columns,rowCount){
    const values=[];
    for(let start=1;start<=rowCount;start+=500){
      const range=quote(title)+'!A'+start+':'+columns+Math.min(start+499,rowCount);
      const part=await this.request('/values/'+encodeURIComponent(range)+'?valueRenderOption=UNFORMATTED_VALUE');
      const rows=part.values||[];while(values.length<start-1)values.push([]);values.push(...rows);
    }
    while(values.length&&!values.at(-1).length)values.pop();return values;
  }
  async append(title,rows){
    if(!rows.length)return;
    return this.request('/values/'+encodeURIComponent(quote(title)+'!A:V')+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS','POST',{majorDimension:'ROWS',values:rows});
  }
}
