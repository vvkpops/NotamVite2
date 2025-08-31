// server.js - Complete Updated Version for Vite
const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Initialize Express app
const app = express();

// Middleware for parsing JSON and serving static files
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Enhanced CORS configuration for Vite
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://*.railway.app',
    'https://*.up.railway.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173', // Vite dev server
    'http://localhost:4173'  // Vite preview server
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.some(allowed => 
    allowed.includes('*') ? origin?.includes(allowed.replace('*', '')) : allowed === origin
  )) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

// Get FAA API credentials from environment variables or config file
let CLIENT_ID, CLIENT_SECRET;

try {
  // First, try environment variables (Railway preferred method)
  CLIENT_ID = process.env.FAA_CLIENT_ID;
  CLIENT_SECRET = process.env.FAA_CLIENT_SECRET;
  
  // If not in environment variables, try config file (fallback)
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.log("⚠️  Credentials not found in environment variables, trying config.json");
    
    if (fs.existsSync('./config.json')) {
      const config = require('./config.json');
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
    throw new Error("FAA API credentials not found");
  }
  
} catch (err) {
  console.error("❌ ERROR LOADING CREDENTIALS:", err.message);
  console.error("📝 Please set FAA_CLIENT_ID and FAA_CLIENT_SECRET environment variables");
  console.error("   Or ensure config.json exists with faa_client_id and faa_client_secret");
  process.exit(1);
}

// Serve static files from Vite build (dist folder) with enhanced error handling
const buildPath = path.join(__dirname, 'dist');
console.log('🔍 Checking for build directory:', buildPath);

if (fs.existsSync(buildPath)) {
  console.log('✅ Build directory found, serving static files from:', buildPath);
  app.use(express.static(buildPath, {
    maxAge: '1y',
    etag: true,
    lastModified: true
  }));
} else {
  console.warn('⚠️  Vite build directory not found at:', buildPath);
  console.warn('📝 Make sure to run "npm run build" first');
  
  // Create a simple fallback response for root route
  app.get('/', (req, res) => {
    res.status(503).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>NOTAM Dashboard V2 - Build Required</title>
        <style>
          body { font-family: Inter, sans-serif; margin: 40px; background: #0f172a; color: #e2e8f0; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px; background: rgba(30, 41, 59, 0.6); border-radius: 12px; }
          h1 { color: #fbbf24; }
          code { background: #374151; padding: 4px 8px; border-radius: 4px; font-family: monospace; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>⚠️ Build Not Found</h1>
          <p>The NOTAM Dashboard application hasn't been built yet.</p>
          <p>Run <code>npm run build</code> to create the production build.</p>
          <p><strong>Expected build directory:</strong> <code>${buildPath}</code></p>
          <p><strong>Current working directory:</strong> <code>${process.cwd()}</code></p>
        </div>
      </body>
      </html>
    `);
  });
}

// Enhanced health check endpoint for Railway/Docker
app.get('/health', (req, res) => {
  const buildExists = fs.existsSync(buildPath);
  const indexExists = fs.existsSync(path.join(buildPath, 'index.html'));
  
  res.status(200).json({ 
    status: 'healthy',
    service: 'NOTAM Dashboard V2',
    version: process.env.npm_package_version || '2.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'production',
    buildTool: 'Vite',
    build: {
      directoryExists: buildExists,
      indexExists: indexExists,
      path: buildPath,
      files: buildExists ? fs.readdirSync(buildPath).length : 0
    },
    credentials: {
      clientIdConfigured: !!CLIENT_ID,
      clientSecretConfigured: !!CLIENT_SECRET
    }
  });
});

// Add minimal /ping endpoint (compatible with Railway container healthchecks)
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Status endpoint with more detailed information
app.get('/api/status', (req, res) => {
  res.status(200).json({
    service: 'NOTAM Dashboard V2',
    version: process.env.npm_package_version || '2.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: Math.floor(process.uptime()),
      readable: formatUptime(process.uptime())
    },
    environment: process.env.NODE_ENV || 'production',
    buildTool: 'Vite',
    nodeVersion: process.version,
    platform: process.platform,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    },
    api: {
      faaCredentialsConfigured: !!(CLIENT_ID && CLIENT_SECRET),
      baseUrl: 'https://external-api.faa.gov/notamapi/v1'
    }
  });
});

// Centralized CFPS Parser from `cfpsParser.cjs`
const { normalizeCFPSNotam } = require('./src/utils/cfpsParser.cjs');

async function fetchNavCanadaNotamsServerSide(icao) {
  const upperIcao = (icao || '').toUpperCase();
  if (!/^[A-Z]{4}$/.test(upperIcao)) {
    return [];
  }

  const navUrl = `https://plan.navcanada.ca/weather/api/alpha/?site=${upperIcao}&alpha=notam`;
  try {
    console.log(`[NAVCAN] Fetching ${upperIcao} from: ${navUrl}`);
    
    const resp = await axios.get(navUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'NOTAM-Dashboard-V2/Server',
        'Accept': 'application/json'
      },
      validateStatus: (s) => s < 500
    });

    if (resp.status >= 400) {
      console.warn(`[NAVCAN] HTTP ${resp.status} for ${upperIcao}`);
      return [];
    }

    const rawData = resp.data;
    if (!rawData) {
      console.log(`[NAVCAN] Empty payload for ${upperIcao}`);
      return [];
    }
    
    let items = [];
    if (Array.isArray(rawData)) items = rawData;
    else if (Array.isArray(rawData.alpha)) items = rawData.alpha;
    else if (Array.isArray(rawData.notams)) items = rawData.notams;
    else if (Array.isArray(rawData.data)) items = rawData.data;

    if (items.length === 0) {
        console.log(`[CFPS] No NOTAM items found for ${icao}`);
        return [];
    }

    const normalizedNotams = items.map((item, index) => {
        return normalizeCFPSNotam(item, upperIcao, index);
    }).filter(Boolean); // Filter out any nulls from parsing errors

    console.log(`[CFPS] Successfully parsed ${normalizedNotams.length} NOTAMs for ${icao}`);
    return normalizedNotams;

  } catch (err) {
    console.error(`[NAVCAN] Error fetching ${upperIcao}:`, err.message || err);
    return [];
  }
}

// NOTAM API endpoint with FAA primary and NAV CANADA server-side fallback
app.get('/api/notams', async (req, res) => {
  const startTime = Date.now();
  const icao = (req.query.icao || '').toUpperCase().trim();
  
  console.log(`[${new Date().toISOString()}] NOTAM request for ICAO: ${icao}`);
  
  if (!icao || icao.length !== 4 || !/^[A-Z]{4}$/.test(icao)) {
    console.log(`[${new Date().toISOString()}] Invalid ICAO: ${icao}`);
    return res.status(400).json({ 
      error: "Invalid ICAO code",
      message: "ICAO code must be exactly 4 uppercase letters",
      example: "KJFK"
    });
  }

  try {
    const url = `https://external-api.faa.gov/notamapi/v1/notams?icaoLocation=${icao}&responseFormat=geoJson&pageSize=1000`;
    console.log(`[${new Date().toISOString()}] Fetching from FAA API: ${url}`);

    const notamRes = await axios.get(url, {
      headers: {
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'User-Agent': 'NOTAM-Dashboard-V2/2.0.0',
        'Accept': 'application/json'
      },
      timeout: 15000,
      validateStatus: (status) => status < 500
    });

    console.log(`[${new Date().toISOString()}] FAA API response status: ${notamRes.status}`);
    
    if (notamRes.status === 429) {
      console.log(`[${new Date().toISOString()}] Rate limited for ${icao}`);
      return res.status(429).json({ 
        error: "Rate limited",
        message: "Too many requests to FAA API. Please try again later.",
        retryAfter: notamRes.headers['retry-after'] || 60
      });
    }
    
    if (notamRes.status >= 400) {
      console.log(`[${new Date().toISOString()}] FAA API error ${notamRes.status} for ${icao}`);
      if (icao.startsWith('C')) {
        console.log(`[${new Date().toISOString()}] Trying NAV CANADA fallback after FAA error for ${icao}`);
        const navNotams = await fetchNavCanadaNotamsServerSide(icao);
        if (navNotams && navNotams.length > 0) {
          return res.json({
            data: navNotams,
            metadata: {
              icao,
              total: navNotams.length,
              processingTime: Date.now() - startTime,
              timestamp: new Date().toISOString(),
              source: 'NAVCAN (FAA fallback)'
            }
          });
        }
      }
      return res.status(notamRes.status).json({ 
        error: "FAA API error",
        status: notamRes.status,
        message: notamRes.data?.message || "Error from FAA API"
      });
    }

    if (!notamRes.data) {
      console.error(`[${new Date().toISOString()}] Empty response data for ${icao}`);
      if (icao.startsWith('C')) {
        const navNotams = await fetchNavCanadaNotamsServerSide(icao);
        return res.json({
          data: navNotams,
          metadata: {
            icao,
            total: navNotams.length,
            processingTime: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            source: 'NAVCAN'
          }
        });
      }
      return res.status(500).json({ error: "Empty response from FAA API" });
    }
    
    if (!notamRes.data.items) {
      console.warn(`[${new Date().toISOString()}] FAA payload missing items array for ${icao}`, 
        JSON.stringify(notamRes.data).substring(0, 200));
      if (icao.startsWith('C')) {
        const navNotams = await fetchNavCanadaNotamsServerSide(icao);
        if (navNotams && navNotams.length > 0) {
          return res.json({
            data: navNotams,
            metadata: {
              icao,
              total: navNotams.length,
              processingTime: Date.now() - startTime,
              timestamp: new Date().toISOString(),
              source: 'NAVCAN'
            }
          });
        }
      }
      return res.status(500).json({ error: "Unexpected response format from FAA API" });
    }

    const items = notamRes.data.items || [];
    console.log(`[${new Date().toISOString()}] Processing ${items.length} raw NOTAMs for ${icao}`);
    
    let parsed = [];
    
    try {
      parsed = items.map((item, index) => {
        try {
          const core = item.properties?.coreNOTAMData?.notam || {};
          const translation = (item.properties?.coreNOTAMData?.notamTranslation || [])[0] || {};
          
          return {
            id: `${icao}-${core.number || index}`,
            number: core.number || '',
            type: core.type || '',
            classification: core.classification || '',
            icao: core.icaoLocation || core.location || icao,
            location: core.location || '',
            validFrom: core.effectiveStart || core.issued || '',
            validTo: core.effectiveEnd || '',
            summary: translation.simpleText || translation.formattedText || core.text || '',
            body: core.text || '',
            qLine: translation.formattedText?.split('\n')[0] || '',
            issued: core.issued || '',
            source: 'FAA',
            processedAt: new Date().toISOString()
          };
        } catch (itemError) {
          console.error(`[${new Date().toISOString()}] Error parsing NOTAM item ${index}:`, itemError);
          return null;
        }
      }).filter(Boolean);
      
    } catch (parseErr) {
      console.error(`[${new Date().toISOString()}] Failed to parse NOTAM data for ${icao}:`, parseErr);
      return res.status(500).json({ 
        error: "Failed to parse NOTAM data", 
        details: parseErr.message 
      });
    }

    console.log(`[${new Date().toISOString()}] Successfully parsed ${parsed.length} NOTAMs for ${icao}`);

    // Filter for currently valid or future NOTAMs only
    const now = new Date();
    const validNotams = parsed.filter(notam => {
      if (!notam.validTo) return true;
      try {
        return new Date(notam.validTo) >= now;
      } catch {
        return true;
      }
    });

    // If FAA returned zero valid notams AND ICAO is Canadian, attempt NAV CANADA fallback
    if ((validNotams.length === 0 || parsed.length === 0) && icao.startsWith('C')) {
      console.log(`[${new Date().toISOString()}] FAA returned zero NOTAMs for ${icao}, trying NAV CANADA fallback`);
      const navNotams = await fetchNavCanadaNotamsServerSide(icao);
      if (navNotams && navNotams.length > 0) {
        const processingTime = Date.now() - startTime;
        console.log(`[${new Date().toISOString()}] Returning ${navNotams.length} NAVCAN NOTAMs for ${icao} (${processingTime}ms)`);
        return res.json({
          data: navNotams,
          metadata: {
            icao,
            total: navNotams.length,
            processingTime,
            timestamp: new Date().toISOString(),
            source: 'NAVCAN'
          }
        });
      }
      console.log(`[${new Date().toISOString()}] NAV CANADA fallback returned no results for ${icao}`);
    }

    // Sort by dispatcher priority
    validNotams.sort((a, b) => {
      const isClosureA = /clsd|closed/i.test(a.summary);
      const isRscA = /rsc/i.test(a.summary);
      const isCrfiA = /crfi/i.test(a.summary);

      const isClosureB = /clsd|closed/i.test(b.summary);
      const isRscB = /rsc/i.test(b.summary);
      const isCrfiB = /crfi/i.test(b.summary);

      if (isClosureA && !isClosureB) return -1;
      if (!isClosureA && isClosureB) return 1;
      if (isRscA && !isRscB) return -1;
      if (!isRscA && isRscB) return 1;
      if (isCrfiA && !isCrfiB) return -1;
      if (!isCrfiA && isCrfiB) return 1;

      try {
        const dateA = new Date(a.validFrom || a.issued);
        const dateB = new Date(b.validFrom || b.issued);
        return dateB - dateA;
      } catch {
        return 0;
      }
    });

    const limitedNotams = validNotams.slice(0, 50);
    
    const processingTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Sending ${limitedNotams.length} NOTAMs for ${icao} (${processingTime}ms)`);

    res.json({
      data: limitedNotams,
      metadata: {
        icao,
        total: limitedNotams.length,
        filtered: parsed.length - validNotams.length,
        processingTime,
        timestamp: new Date().toISOString(),
        source: 'FAA API v1'
      }
    });

  } catch (err) {
    const processingTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] Error fetching NOTAMs for ${icao} (${processingTime}ms):`, err.message);
    
    if (err.code === 'ECONNABORTED' || err.code === 'ENOTFOUND') {
      return res.status(503).json({ 
        error: "Service temporarily unavailable", 
        message: "Unable to connect to FAA API",
        details: err.message
      });
    }
    
    if (err.response) {
      return res.status(err.response.status || 500).json({ 
        error: "FAA API error", 
        status: err.response.status,
        message: err.response.data?.message || err.message
      });
    }
    
    res.status(500).json({ 
      error: "Internal server error", 
      message: "An unexpected error occurred",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Enhanced catch all handler for React Router with better error handling
app.get('*', (req, res) => {
  const indexPath = path.join(buildPath, 'index.html');
  
  if (fs.existsSync(indexPath)) {
    console.log(`📄 Serving index.html for route: ${req.path}`);
    res.sendFile(indexPath);
  } else {
    console.error(`❌ index.html not found at: ${indexPath}`);
    res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>NOTAM Dashboard V2 - Application Not Built</title>
        <style>
          body { font-family: Inter, sans-serif; margin: 40px; background: #0f172a; color: #e2e8f0; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px; background: rgba(30, 41, 59, 0.6); border-radius: 12px; }
          h1 { color: #ef4444; }
          h2 { color: #fbbf24; }
          code { background: #374151; padding: 4px 8px; border-radius: 4px; font-family: monospace; }
          ol { text-align: left; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>❌ Application Not Built</h1>
          <p>The React application hasn't been built for production.</p>
          <p><strong>Expected index.html at:</strong> <code>${indexPath}</code></p>
          <p><strong>Build directory exists:</strong> ${fs.existsSync(buildPath) ? '✅ Yes' : '❌ No'}</p>
          <h2>To fix this:</h2>
          <ol>
            <li>Run <code>npm run build</code></li>
            <li>Restart the server with <code>npm start</code></li>
          </ol>
          <p><strong>Current working directory:</strong> <code>${process.cwd()}</code></p>
          <p><strong>Node.js version:</strong> <code>${process.version}</code></p>
        </div>
      </body>
    </html>
    `);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Unhandled error:`, err);
  res.status(500).json({
    error: "Internal server error",
    message: "An unexpected error occurred"
  });
});

// Utility function to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m ${secs}s`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

// Start server with enhanced logging
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 NOTAM Dashboard V2 (Vite) running on port ${PORT}`);
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`🏗️  Build tool: Vite`);
  console.log(`📁 Serving from: ${buildPath}`);
  console.log(`📄 Index file: ${path.join(buildPath, 'index.html')}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Status endpoint: http://localhost:${PORT}/api/status`);
  console.log(`🔑 FAA API Credentials: ${CLIENT_ID && CLIENT_SECRET ? '✅ Configured' : '❌ Missing'}`);
  
  // Check build status on startup
  if (!fs.existsSync(buildPath)) {
    console.error(`❌ WARNING: Build directory not found at ${buildPath}`);
    console.error(`📝 Run "npm run build" to create the production build`);
  } else if (!fs.existsSync(path.join(buildPath, 'index.html'))) {
    console.error(`❌ WARNING: index.html not found in build directory`);
    console.error(`📝 The build may be incomplete`);
  } else {
    const buildFiles = fs.readdirSync(buildPath);
    console.log(`✅ Build files found and ready to serve (${buildFiles.length} files)`);
    console.log(`📋 Build contents: ${buildFiles.slice(0, 10).join(', ')}${buildFiles.length > 10 ? '...' : ''}`);
  }
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;
