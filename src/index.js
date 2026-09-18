import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/api.js';
import dashboardRoutes from './routes/dashboard.js';
import { whatsappService } from './whatsapp.js';
import { apiKeyService } from './apiKeyService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static dashboard UI
app.use(express.static(path.join(__dirname, '..', 'public')));

// Mount API routes (dashboard routes first, then external API routes)
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', apiRoutes);

// Fallback to dashboard UI
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start server
app.listen(PORT, async () => {
  console.log('\n======================================================');
  console.log('🚀 WhatsApp OTP Gateway & API Service Started');
  console.log(`🌐 Local Dashboard: http://localhost:${PORT}`);
  console.log(`📡 REST API Base:   http://localhost:${PORT}/api`);
  console.log('======================================================\n');

  // Print existing API keys for easy first-time access
  const keys = apiKeyService.getAllKeys();
  if (keys.length > 0) {
    console.log(`🔑 Active Primary API Key: ${keys[0].key}`);
    console.log('   (Use in request header: "x-api-key: ' + keys[0].key + '")\n');
  }

  // Initialize WhatsApp client
  console.log('[WhatsApp] Booting connection manager...');
  await whatsappService.init();
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nTerminated. Shutting down gracefully...');
  process.exit(0);
});
