// NOTAM API service that calls the backend.
export const fetchNotamsForIcao = async (icao) => {
  try {
    const response = await fetch(`/api/notams?icao=${icao}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    
    const result = await response.json();

    if (!response.ok) {
      console.error(`[notamService] Server returned error for ${icao}:`, result.error || response.statusText);
      return { 
        error: result.error || `HTTP error! status: ${response.status}`,
        details: result.details 
      };
    }
    
    return { data: result.data || [], source: result.source };
    
  } catch (error) {
    console.error(`[notamService] Network or parsing error for ${icao}:`, error);
    return { error: error.message || 'A network error occurred.' };
  }
};

export default fetchNotamsForIcao;
