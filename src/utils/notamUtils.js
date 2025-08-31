// src/utils/cfpsParser.cjs - V3 - Robust and Defensive Parser

function normalizeDateFromText(text) {
  if (!text) return '';
  // Look for YYMMDDHHMM format, which is very common
  const match = text.match(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (match) {
    const [, year, month, day, hour, minute] = match;
    const fullYear = `20${year}`;
    // Basic validation
    if (parseInt(month) <= 12 && parseInt(day) <= 31) {
      return new Date(`${fullYear}-${month}-${day}T${hour}:${minute}:00Z`).toISOString();
    }
  }
  return '';
}

function parseNotamText(rawText) {
  const lines = rawText.split('\n').map(l => l.trim());
  let content = '';
  let validFrom = '';
  let validTo = '';
  let number = '';

  const notamNumberMatch = rawText.match(/([A-Z]\d{4}\/\d{2})/);
  if (notamNumberMatch) {
    number = notamNumberMatch[1];
  }

  for (const line of lines) {
    if (line.startsWith('E)')) {
      content += line.substring(2).trim() + ' ';
    } else if (line.startsWith('B)')) {
      validFrom = normalizeDateFromText(line);
    } else if (line.startsWith('C)')) {
      validTo = normalizeDateFromText(line);
    }
  }

  // If E) line was not found, use the whole text as content
  if (!content) {
    content = lines.join(' ').replace(/\s+/g, ' ');
  }

  return {
    summary: content.slice(0, 250), // Create a summary
    body: content,
    validFrom,
    validTo,
    number,
  };
}

function normalizeCFPSNotam(item, icao, index) {
  try {
    // The 'raw' or 'text' field from NAVCAN is the most reliable source
    const rawText = item.raw || item.text || '';
    
    if (!rawText) {
        console.warn(`[CFPS Parser] Skipping item for ${icao} due to empty content.`);
        return null;
    }

    const parsed = parseNotamText(rawText);
    
    const validFrom = parsed.validFrom || normalizeDateFromText(item.start) || new Date().toISOString();
    const validTo = parsed.validTo || normalizeDateFromText(item.end) || '';

    const number = parsed.number || item.id || `NVCAN-${index}`;
    const id = `${icao}-${number}`;

    return {
      id,
      number: number,
      type: 'A', // NAVCAN doesn't provide a clear type, default to 'A' (New)
      classification: 'NAVCAN',
      icao: icao.toUpperCase(),
      location: icao.toUpperCase(),
      validFrom,
      validTo,
      summary: parsed.summary || 'Content not available.',
      body: parsed.body || 'Content not available.',
      qLine: '', // NAVCAN does not provide a standard Q-Line
      issued: validFrom,
      source: 'NAVCAN',
    };
  } catch (error) {
    console.error(`[CFPS Parser] Error normalizing NAVCAN NOTAM for ${icao}:`, error);
    return null;
  }
}

module.exports = {
  normalizeCFPSNotam
};
