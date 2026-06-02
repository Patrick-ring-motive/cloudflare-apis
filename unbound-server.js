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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    url.hostname = url.hostname.replace(/-unbound/i,'');
    const unboundAPIKey = request.headers.get('unbound-api-key') || url.searchParams.get('unbound-api-key');
    if(unboundAPIKey != env.UNBOUND_API_KEY){
      return new Response(null,{status:403});
    }
    const domain = url.hostname.split('.').slice(1).join('.');
    const subdomain = request.headers.get('subdomain') || url.searchParams.get('subdomain');
    url.hostname = `${subdomain}.${domain}`;
    return fetchResponse(String(url),request);
  }
};
