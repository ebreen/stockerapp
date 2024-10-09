import { useState, useEffect } from 'react';
import axios from 'axios';
import Image from 'next/image';
import localFont from "next/font/local";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

const API_KEY = 'LENORCUHYW7QR3N3'; // Replace with your actual API key

interface StockData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

interface ChartData {
  date: string;
  price: number;
}

export default function Home() {
  const [ticker, setTicker] = useState('');
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStockData = async (symbol: string) => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.get(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`);
      const data = response.data['Global Quote'];
      setStockData({
        symbol: data['01. symbol'],
        price: parseFloat(data['05. price']),
        change: parseFloat(data['09. change']),
        changePercent: parseFloat(data['10. change percent'].replace('%', '')),
      });

      const historicalResponse = await axios.get(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${API_KEY}`);
      const historicalData = historicalResponse.data['Time Series (Daily)'];
      const chartData = Object.entries(historicalData).slice(0, 30).map(([date, values]: [string, any]) => ({
        date,
        price: parseFloat(values['4. close']),
      })).reverse();
      setChartData(chartData);
    } catch (err) {
      setError('Failed to fetch stock data. Please try again.');
      setStockData(null);
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (ticker) {
      fetchStockData(ticker);
    }
  };

  return (
    <div className={`${geistSans.variable} ${geistMono.variable} grid grid-rows-[auto_1fr_auto] min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100`}>
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
            <h2 className="text-2xl font-semibold mb-4">{stockData.symbol}</h2>
            <p className="text-3xl font-bold text-green-500">${stockData.price.toFixed(2)}</p>
            <p className={`text-lg ${stockData.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {stockData.change.toFixed(2)} ({stockData.changePercent.toFixed(2)}%)
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
  );
}
