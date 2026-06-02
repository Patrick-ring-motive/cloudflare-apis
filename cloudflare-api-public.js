import { env } from "cloudflare:workers";

const fetchResponse = async (...args) => {
  try {
    return await fetch(...args);
  } catch (e) {
    return new Response(String(e), {
      status: 500,
      statusText: String(e)
    });
  }
};

async function fetchUnbound(urlreq,options){
  const url = new URL(String(urlreq?.url ?? urlreq));
  const domainParts = url.hostname.split('.');
  const subdomain = String(domainParts[0]);
  domainParts[0] = 'unbound';
  domainParts[1] = `${domainParts[1]}-unbound`;
  url.hostname = domainParts.join('.');
  const headers = urlreq.headers ?? options?.headers;
  const value = new Headers(headers?.entries?.() ?? headers ?? {});
  value.set('subdomain',subdomain);
  value.set('unbound-api-key',String(env.UNBOUND_API_KEY));
  const prereq = Object(options ?? urlreq);
  Object.defineProperty(prereq,'headers',{value});
  const req = new Request(String(url),prereq);
  return fetchResponse(req);  
}

const $text = async (x) =>{
  try{
    return String(await x.text());
  }catch(e){
    console.warn(e);
    return String(x);
  }
};

const isArray = x => Array.isArray(x) || x instanceof Array;
const isString = (val) => typeof val === "string" || val instanceof String;

const stringify = x => {
  if (isString(x)) {
    return String(x);
  }
  try {
    return String(JSON.stringify(x));
  } catch {
    return String(x);
  }
};

const parseList = x =>{
  let arr = [];
  try{
    arr = JSON.parse(x);
    if(!isArray(arr))return [arr];
  }catch{}
  return arr;
}

const vars = {}; 

const init = async ()=>{
  const res = await fetchUnbound('https://links.api-cloud-flare.workers.dev/api/');
  const txt = await $text(res);
  vars.links = parseList(txt).filter(x=>x.includes('{account_id}'));
};

const targetHost = 'api.cloudflare.com';
let ready;
export default {
  async fetch(request, env, ctx) {
    if(!ready) ready = init();
    if(ready instanceof Promise) ready = await ready;
    const url = new URL(request.url);
    url.host = targetHost;
    const accountPath = vars.links.find(x=>url.pathname.replace(/^\/client\/v\d+/,'')==(x.replace('{account_id}','').replace('//','/')));
    if(accountPath){
      url.pathname = url.pathname.match(/^\/client\/v\d+/)[0] + accountPath.replaceAll('{account_id}',String(env.ACCOUNT_ID));
    }
    console.log(url)
    const headers = new Headers(request.headers.entries());
    Object.defineProperty(request,'method',{value:'GET'});
    Object.defineProperty(request,'headers',{value:headers});
    const req = new Request(String(url),request);
    req.headers.set('Authorization',`Bearer ${env.CLOUDFLARE_API_TOKEN}`);
    const reqClone = req.clone();
    let res = await fetchResponse(req);
    if(!/^2/.test(res.status)){
      reqClone.headers.set('Authorization',`Bearer ${env.ACCOUNT_TOKEN}`);
      res = await fetchResponse(reqClone);
    }
    const text = await $text(res.clone());
    for(const key in env){
      if(text.includes(env[key])){
        return new Response(null,{status:403});
      }
    }
    if(!/^2/.test(res.status))console.warn(res.status,res.statusText);
    return res;
  }
};
