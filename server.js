// This is a test change
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const WebSocket = require('ws');

// Serve the index.html file
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const symbols = [
  'BINANCE:BTCUSDT',
  'BINANCE:ETHUSDT',
  'OANDA:EUR_USD',
  'OANDA:GBP_USD',
  'OANDA:USD_JPY',
  'OANDA:AUD_USD',
  'OANDA:USD_CAD',
  'OANDA:USD_CHF'
];

const finnhub_ws = new WebSocket('wss://ws.finnhub.io?token=d2lbqa9r01qqq9quats0d2lbqa9r01qqq9quatsg');

// Stop Loss and Take Profit logic
const openTrades = {};

finnhub_ws.onopen = () => {
  console.log('Connected to Finnhub WebSocket.');
  symbols.forEach(symbol => {
    const subscriptionMessage = { 'type': 'subscribe', 'symbol': symbol };
    finnhub_ws.send(JSON.stringify(subscriptionMessage));
  });
};

finnhub_ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'trade' && data.data) {
    data.data.forEach(trade => {
      const symbol = trade.s;
      const price = trade.p;
      const time = trade.t;
      const volume = trade.v;

      // Check for Stop Loss and Take Profit
      if (openTrades[symbol]) {
        const tradeData = openTrades[symbol];
        if (tradeData.type === 'BUY') {
          if (price >= tradeData.takeProfit) {
            console.log(`✅ TAKE PROFIT hit for ${symbol}!`);
            io.emit('trading_signal', { symbol, signal: 'TAKE PROFIT', price });
            delete openTrades[symbol];
          } else if (price <= tradeData.stopLoss) {
            console.log(`❌ STOP LOSS hit for ${symbol}!`);
            io.emit('trading_signal', { symbol, signal: 'STOP LOSS', price });
            delete openTrades[symbol];
          }
        }
      }
      
      io.emit('live_data', {
        time,
        price,
        volume,
        symbol
      });
    });
  }
};

finnhub_ws.on('error', (error) => {
  console.error('WebSocket Error:', error.message);
});

// Bot Logic (simple buy/sell signal) and open trades management
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.emit('initial_symbols', symbols);

  socket.on('set_trade_levels', (data) => {
    openTrades[data.symbol] = {
      type: data.type,
      entryPrice: data.entryPrice,
      stopLoss: data.stopLoss,
      takeProfit: data.takeProfit
    };
    console.log(`Trade levels set for ${data.symbol}:`, openTrades[data.symbol]);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});