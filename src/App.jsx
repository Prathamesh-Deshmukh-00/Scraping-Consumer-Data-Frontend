import { BrowserRouter as Router, Routes, Route, Link, NavLink } from "react-router-dom";
import { useState, useEffect } from "react"; // Added imports
import { Sun, Moon } from "lucide-react"; // Added imports
import BillPage from "./Pages/BillPage.jsx";
import FollowUpPage from "./Pages/FollowUpPage.jsx";
import PhotoUploadApp from "./Pages/UploadImages.jsx";
import './App.css'
import axios from 'axios';

// ✅ Global Axios Configuration
axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL || "";

function App() {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  // ✅ Handle dark/light mode globally
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  };

  return (
    <Router>
      <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
        {/* ✅ Navigation Bar */}
        <nav className="p-4 bg-white dark:bg-gray-800 shadow-md mb-4 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto flex flex-wrap gap-4 md:gap-6 items-center justify-between">
            <Link to="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent hover:scale-105 transition-transform">
              CRM Dashboard
            </Link>
            
            <div className="flex items-center gap-4">
              <div className="flex gap-4">
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-lg font-medium transition-all ${isActive
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"}`
                  }
                >
                  📋 Bills
                </NavLink>
                <NavLink
                  to="/pipeline"
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${isActive
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"}`
                  }
                >
                  🚀 Pipeline
                </NavLink>
                <NavLink
                  to="/upload"
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${isActive
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"}`
                  }
                >
                  📷 Upload
                </NavLink>
              </div>

               {/* 🌙 Global Theme Toggle */}
               <button
                onClick={toggleTheme}
                className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-800 dark:text-yellow-400"
                title="Toggle Theme"
              >
                {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </nav>

        {/* ✅ Page Content */}
        <Routes>
          <Route path="/" element={<BillPage theme={theme} />} />
          <Route path="/pipeline" element={<FollowUpPage />} />
          <Route path="/upload" element={<PhotoUploadApp />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
