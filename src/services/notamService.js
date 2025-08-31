// NOTAM API service that calls the backend.
// The server now handles the fallback to NAV CANADA, so the client logic is simpler.
export const fetchNotamsForIcao = async (icao) => {
  try {
    console.log(`[notamService] Fetching NOTAMs for ${icao} from server`);
    
    const response = await fetch(`/api/notams?icao=${icao}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });
    
    console.log(`[notamService] Response status for ${icao}:`, response.status);
    
    const result = await response.json();

    if (!response.ok) {
      console.error(`[notamService] Server returned error for ${icao}:`, result.error || response.statusText);
      return { error: result.error || `HTTP error! status: ${response.status}` };
    }
    
    // The server now wraps the data in a `data` property.
    return result.data || [];
    
  } catch (error) {
    console.error(`[notamService] Network or parsing error for ${icao}:`, error);
    return { error: error.message || 'A network error occurred.' };
  }
};

// Fallback service with retry logic (can be used if needed, but the batching system handles requeueing)
export const fetchNotamsWithRetry = async (icao, retries = 2) => {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      console.log(`[notamService] Attempt ${attempt} for ${icao}`);
      const result = await fetchNotamsForIcao(icao);
      
      // If we get an error object, check if we should retry
      if (result && result.error) {
        // Example: Retry on 5xx errors
        if (result.status >= 500 && attempt <= retries) {
          console.log(`[notamService] Server error, waiting before retry for ${icao}`);
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          continue;
        }
        // Other errors, don't retry
        console.log(`[notamService] API error for ${icao}, no retry:`, result.error);
        return result;
      }
      
      // Success
      return result;
      
    } catch (error) {
      console.warn(`[notamService] Attempt ${attempt} failed for ${icao}:`, error.message);
      
      if (attempt === retries + 1) {
        console.error(`[notamService] All ${retries + 1} attempts failed for ${icao}`);
        return { error: `Failed after ${retries + 1} attempts: ${error.message}` };
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};

export default fetchNotamsForIcao;
