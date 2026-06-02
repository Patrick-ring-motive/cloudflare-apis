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

const targetHost = 'developers.cloudflare.com';
const rex = /(src|href)=["]([^"]*)["]|[>]\/[^<]*[<]|\]\([^\)]*\)/g;
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    url.host = targetHost;
    const req = new Request(String(url),Object.defineProperty(request,'method',{value:'GET'}));
    const res = await fetchResponse(req);
    const text = await res.text();
    const links = (text.match(rex)||[]).map(x=>x.replace(/(src|href)=|["<>\)\[\]]/g,''));
    if(!links.length){
      return new Response(null,{status:404})
    }
    return new Response(stringify([...new Set(links)]));
  }
};
