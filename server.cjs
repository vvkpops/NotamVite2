// server.js - Complete Updated Version for Vite
const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---

// Security headers with a configured Content Security Policy (CSP)
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: [
        "'self'", 
        "https://plan.navcanada.ca",
        "https://vitals.vercel-insights.com"
      ],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  })
);


// CORS configuration
const allowedOrigins = [
  'http://localhost:3000', // Vite dev
  'http://localhost:5173', // Vite default dev
  'http://localhost:4173'  // Vite preview
];
// Add Railway's preview and production URLs if they exist
if (process.env.RAILWAY_STATIC_URL) {
  allowedOrigins.push(`https://${process.env.RAILWAY_STATIC_URL}`);
}
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- Credential Loading ---
let CLIENT_ID, CLIENT_SECRET;
try {
  CLIENT_ID = process.env.FAA_CLIENT_ID;
  CLIENT_SECRET = process.env.FAA_CLIENT_SECRET;
  
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.log("⚠️  Credentials not found in environment variables, trying config.json");
    const configPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      CLIENT_ID = config.faa_client_id;
      CLIENT_SECRET = config.faa_client_secret;
      console.log("✅ Credentials loaded from config.json");
    } else {
      console.log("⚠️  config.json not found");
    }
  } else {
    console.log("✅ Credentials loaded from environment variables");
  }
  
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("FAA API credentials not found in env variables or config.json");
  }
} catch (err) {
  console.error("❌ FATAL ERROR LOADING CREDENTIALS:", err.message);
  // Don't exit in a running server environment, just log the error.
}

// --- Static File Serving ---
const buildPath = path.join(__dirname, 'dist');
console.log('🔍 Serving static files from:', buildPath);
app.use(express.static(buildPath));

// --- API Routes ---

// Health check endpoint
app.get('/health', (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    faacreds: !!(CLIENT_ID && CLIENT_SECRET),
    buildExists: fs.existsSync(buildPath)
  };
  try {
    res.status(healthcheck.faacreds && healthcheck.buildExists ? 200 : 503).send(healthcheck);
  } catch (error) {
    healthcheck.message = error.message;
    res.status(503).send(healthcheck);
  }
});

app.get('/ping', (req, res) => res.status(200).send('pong'));

// NOTAM API endpoint
const { normalizeCFPSNotam } = require('./src/utils/cfpsParser.cjs');

async function fetchNavCanadaNotamsServerSide(icao) {
  const upperIcao = (icao || '').toUpperCase();
  if (!/^[A-Z]{4}$/.test(upperIcao)) return { data: [], error: 'Invalid ICAO for NAVCAN' };
  const navUrl = `https://plan.navcanada.ca/weather/api/alpha/?site=${upperIcao}&alpha=notam`;
  try {
    console.log(`[NAVCAN] Fetching ${upperIcao}`);
    const resp = await axios.get(navUrl, { timeout: 8000 });
    const items = resp.data?.alpha || [];
    const data = items.map((item, index) => normalizeCFPSNotam(item, upperIcao, index)).filter(Boolean);
    return { data, source: 'NAVCAN' };
  } catch (err) {
    console.error(`[NAVCAN] Error for ${upperIcao}:`, err.message);
    return { data: [], error: err.message };
  }
}

app.get('/api/notams', async (req, res) => {
  const { icao } = req.query;
  if (!icao || !/^[A-Z]{4}$/.test(icao)) {
    return res.status(400).json({ error: "Invalid ICAO code provided." });
  }

  try {
    const url = `https://external-api.faa.gov/notamapi/v1/notams?icaoLocation=${icao}&responseFormat=geoJson&pageSize=500`;
    const notamRes = await axios.get(url, {
      headers: { 'client_id': CLIENT_ID, 'client_secret': CLIENT_SECRET, 'User-Agent': 'NOTAM-Dashboard-V2/2.1.0' },
      timeout: 10000,
    });

    const items = notamRes.data?.items || [];
    let parsed = items.map((item, index) => {
      const core = item.properties?.coreNOTAMData?.notam || {};
      const translation = (item.properties?.coreNOTAMData?.notamTranslation || [])[0] || {};
      return {
        id: `${icao}-${core.number || index}`, number: core.number || '', type: core.type || '',
        classification: core.classification || '', icao: core.icaoLocation || icao, location: core.location || '',
        validFrom: core.effectiveStart || core.issued || '', validTo: core.effectiveEnd || '',
        summary: translation.simpleText || core.text || '', body: core.text || '',
        qLine: (translation.formattedText || '').split('\n')[0], issued: core.issued || '', source: 'FAA',
      };
    }).filter(notam => !notam.validTo || new Date(notam.validTo) >= new Date());

    if (parsed.length === 0 && icao.startsWith('C')) {
      console.log(`FAA returned 0 for ${icao}, trying NAVCAN fallback.`);
      const navcanResult = await fetchNavCanadaNotamsServerSide(icao);
      return res.json({ data: navcanResult.data, source: navcanResult.source || 'NAVCAN' });
    }
    
    res.json({ data: parsed, source: 'FAA' });

  } catch (error) {
    console.error(`[Server] Error fetching NOTAMs for ${icao}:`, error.message);
    
    if (icao.startsWith('C')) {
      console.log(`[Server] FAA request failed for ${icao}, trying NAVCAN fallback.`);
      const navcanResult = await fetchNavCanadaNotamsServerSide(icao);
      if (navcanResult.data.length > 0) {
        return res.json({ data: navcanResult.data, source: navcanResult.source || 'NAVCAN' });
      }
    }
    
    const status = error.response?.status || 500;
    res.status(status).json({ 
      error: "Failed to fetch NOTAMs from primary source.", 
      details: error.message,
      icao
    });
  }
});

// --- Catch-all for React Router ---
app.get('*', (req, res) => {
  const indexPath = path.join(buildPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`
      <h1>404 - Not Found</h1>
      <p>The application has not been built correctly. Missing index.html.</p>
      <p>Please run 'npm run build' and restart the server.</p>
    `);
  }
});

// --- Server Startup ---
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🏥 Health check available at http://localhost:${PORT}/health`);
});
