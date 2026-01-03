/**
 * A lightweight replacement for Octokit that communicates with a custom GitHub proxy.
 * It wraps requests into a format the proxy expects: { method, endpoint, body }.
 */
export function createProxyClient(proxyUrl: string, proxyKey: string) {
  return {
    request: async (route: string, params: any = {}) => {
      // 1. Parse the route string (e.g., "POST /gists")
      const [methodPart, endpointPart] = route.split(' ');
      
      // Handle cases like "POST /gists" vs just "/gists" (default GET)
      const method = endpointPart ? methodPart : 'GET';
      let endpoint = endpointPart ? endpointPart : methodPart;

      // Remove leading slash if present (proxy expects "gists", not "/gists")
      if (endpoint.startsWith('/')) endpoint = endpoint.substring(1);

      // 2. Construct the exact payload for the Cloud Run Proxy
      const requestPayload = {
        method: method,
        endpoint: endpoint,
        body: params // Octokit params become the body
      };

      console.log(`[proxyService:request] Initiating Proxy Request:`, {
        url: proxyUrl,
        headers: {
          'Content-Type': 'application/json',
          'x-proxy-key': proxyKey // Shown in logs for verification as requested
        },
        payload: requestPayload
      });

      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-proxy-key': proxyKey // Your secure password ("dbdm")
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        // Log status to help debugging since statusText is often empty in browsers
        const errorMsg = `Proxy Error: ${response.status} ${response.statusText}`;
        console.error(`[proxyService:request] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      const data = await response.json();
      console.log(`[proxyService:request] Proxy Response received successfully:`, data);
      return data;
    }
  };
}
