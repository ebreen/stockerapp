import { useState, useEffect } from 'react';
import axios from 'axios';
import Image from 'next/image';
import localFont from "next/font/local";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../lib/supabase';

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const FINNHUB_API_KEY = process.env.NEXT_PUBLIC_FINNHUB_API_KEY;

interface StockData {
  symbol: string;
  price: number;
  change: number;
  percentChange: number;
}

interface ChartData {
  date: string;
  price: number;
}

interface WatchlistItem {
  id: number;
  symbol: string;
  price?: number;
  change?: number;
  percentChange?: number;
}

function WatchlistSidepanel({ watchlist, onRemove, onSelect }: { 
  watchlist: WatchlistItem[], 
  onRemove: (symbol: string) => void,
  onSelect: (symbol: string) => void
}) {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Watchlist</h2>
      {watchlist.length === 0 ? (
        <p>Your watchlist is empty.</p>
      ) : (
        <ul>
          {watchlist.map((item) => (
            <li key={item.id} className="flex justify-between items-center mb-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              <div className="flex flex-col cursor-pointer" onClick={() => onSelect(item.symbol)}>
                <span className="font-semibold">{item.symbol}</span>
                {item.price && (
                  <span className="text-sm">${item.price.toFixed(2)}</span>
                )}
                {item.change && item.percentChange && (
                  <span className={`text-sm ${item.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {item.change.toFixed(2)} ({item.percentChange.toFixed(2)}%)
                  </span>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.symbol);
                }}
                className="text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Home() {
  const [ticker, setTicker] = useState('');
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [showWatchlist, setShowWatchlist] = useState(false);

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const fetchStockData = async (symbol: string): Promise<StockData> => {
    try {
      const response = await axios.get(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`);
      const data = response.data;
      return {
        symbol: symbol,
        price: data.c,
        change: data.d,
        percentChange: data.dp
      };
    } catch (err) {
      console.error('Error fetching stock data:', err);
      throw new Error('Failed to fetch stock data');
    }
  };

  const fetchChartData = async (symbol: string) => {
    try {
      const to = Math.floor(Date.now() / 1000);
      const from = to - 30 * 24 * 60 * 60; // 30 days ago
      const response = await axios.get(`https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`);
      const data = response.data;
      if (data.s === 'ok') {
        const chartData = data.t.map((timestamp: number, index: number) => ({
          date: new Date(timestamp * 1000).toLocaleDateString(),
          price: data.c[index]
        }));
        setChartData(chartData);
      } else {
        console.error('Error fetching chart data:', data);
        setChartData([]);
      }
    } catch (err) {
      console.error('Error fetching chart data:', err);
      setChartData([]);
    }
  };

  const fetchWatchlist = async () => {
    setWatchlistLoading(true);
    try {
      const { data, error } = await supabase
        .from('watchlist')
        .select('*');
      if (error) throw error;
      
      console.log('Fetched watchlist:', data);
      const updatedWatchlist = await Promise.all(
        data.map(async (item) => {
          try {
            const stockData = await fetchStockData(item.symbol);
            return { ...item, ...stockData };
          } catch (err) {
            console.error(`Error fetching data for ${item.symbol}:`, err);
            return item;
          }
        })
      );
      setWatchlist(updatedWatchlist);
    } catch (err) {
      console.error('Error fetching watchlist:', err);
      setError('Failed to fetch watchlist. Please try again.');
    } finally {
      setWatchlistLoading(false);
    }
  };

  const addToWatchlist = async (symbol: string) => {
    console.log('Adding to watchlist:', symbol);
    try {
      const { data, error } = await supabase
        .from('watchlist')
        .insert({ symbol })
        .select()
        .single();
      if (error) throw error;
      
      console.log('Added to watchlist:', data);
      const stockData = await fetchStockData(symbol);
      setWatchlist(prevWatchlist => [...prevWatchlist, { ...data, ...stockData }]);
    } catch (err) {
      console.error('Error adding to watchlist:', err);
      setError('Failed to add to watchlist. Please try again.');
    }
  };

  const removeFromWatchlist = async (symbol: string) => {
    console.log('Removing from watchlist:', symbol);
    try {
      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('symbol', symbol);
      if (error) throw error;
      
      console.log('Removed from watchlist:', symbol);
      setWatchlist(prevWatchlist => prevWatchlist.filter(item => item.symbol !== symbol));
    } catch (err) {
      console.error('Error removing from watchlist:', err);
      setError('Failed to remove from watchlist. Please try again.');
    }
  };

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (ticker) {
      setLoading(true);
      setError('');
      try {
        const data = await fetchStockData(ticker);
        setStockData(data);
        await fetchChartData(ticker);
      } catch (err) {
        console.error('Error in handleSearch:', err);
        setError('Failed to fetch stock data. Please try again.');
        setStockData(null);
      } finally {
        setLoading(false);
      }
    }
  };

  const isInWatchlist = (symbol: string) => watchlist.some(item => item && item.symbol === symbol);

  const handleWatchlistToggle = async (symbol: string) => {
    if (isInWatchlist(symbol)) {
      await removeFromWatchlist(symbol);
    } else {
      await addToWatchlist(symbol);
    }
  };

  const handleWatchlistSelect = (symbol: string) => {
    setTicker(symbol);
    handleSearch({ preventDefault: () => {} } as React.FormEvent<HTMLFormElement>);
  };

  if (watchlistLoading) {
    return <div>Loading watchlist...</div>;
  }

  return (
    <div className={`${geistSans.variable} ${geistMono.variable} grid grid-cols-[1fr_auto] min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100`}>
      <div className="grid grid-rows-[auto_1fr_auto]">
        <header className="p-4 bg-white dark:bg-gray-800 shadow">
          <h1 className="text-4xl font-bold text-center">Stocker</h1>
        </header>

        <main className="container mx-auto px-4 py-8 flex flex-col items-center">
          <form onSubmit={handleSearch} className="mb-8 w-full max-w-md">
            <div className="flex items-center">
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="Enter stock ticker"
                className="flex-grow px-4 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Search'}
              </button>
            </div>
          </form>

          {error && <p className="text-red-500 mb-4">{error}</p>}

          {stockData && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold">{stockData.symbol}</h2>
                <button
                  onClick={() => handleWatchlistToggle(stockData.symbol)}
                  className={`text-2xl ${isInWatchlist(stockData.symbol) ? 'text-yellow-500' : 'text-gray-400'}`}
                >
                  ★
                </button>
              </div>
              <p className="text-3xl font-bold text-green-500">${stockData.price.toFixed(2)}</p>
              <p className={`text-lg ${stockData.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {stockData.change.toFixed(2)} ({stockData.percentChange.toFixed(2)}%)
              </p>
            </div>
          )}

          {chartData.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 w-full max-w-3xl">
              <h2 className="text-2xl font-semibold mb-4">Price Chart</h2>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="price" stroke="#8884d8" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </main>

        <footer className="p-4 bg-white dark:bg-gray-800 shadow flex justify-center items-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            © 2023 Stocker. All rights reserved.
          </p>
        </footer>
      </div>

      <div className={`bg-white dark:bg-gray-800 shadow-md transition-all duration-300 ease-in-out ${showWatchlist ? 'w-64' : 'w-0'} overflow-hidden`}>
        {showWatchlist && <WatchlistSidepanel watchlist={watchlist} onRemove={removeFromWatchlist} onSelect={handleWatchlistSelect} />}
      </div>

      <button
        onClick={() => setShowWatchlist(!showWatchlist)}
        className="fixed top-4 right-4 bg-blue-500 text-white p-2 rounded-full shadow-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {showWatchlist ? '→' : '←'}
      </button>
    </div>
  );
}
