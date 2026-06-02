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
