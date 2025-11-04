import React, { useEffect, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, TrendingUp, TrendingDown, Phone, Calendar, AlertCircle, CheckCircle, Clock, XCircle, Trash2, Sun, Moon, Receipt, Zap } from "lucide-react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

// ✅ Set your backend base URL
axios.defaults.baseURL = "https://scraping-consumer-data.onrender.com";

const BillPage = () => {
  const [bills, setBills] = useState([]);
  const [filteredBills, setFilteredBills] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [showWithMobile, setShowWithMobile] = useState(false);
  const [showWithBill, setShowWithBill] = useState(false);
  const [sortOrder, setSortOrder] = useState("");
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [expandedCard, setExpandedCard] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const MySwal = withReactContent(Swal);

  // ✅ Handle dark/light mode
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  // ✅ Fetch bills from backend
  useEffect(() => {
    const fetchBills = async () => {
      try {
        const res = await axios.get("/api/bills");
        console.log("✅ API Response:", res.data);
        const data = res.data;
        if (Array.isArray(data)) setBills(data);
        else if (data?.data) setBills(data.data);
        else if (data) setBills([data]);
        else setBills([]);
      } catch (err) {
        console.error("❌ Fetch error:", err);
      }
    };
    fetchBills();
  }, []);

  // ✅ Filtering + Sorting
  useEffect(() => {
    let filtered = bills.filter((bill) => {
      const amountToPay = parseInt(bill.amountToPay?.replace(/[^\d]/g, "") || 0);
      const billAmount = parseInt(bill.billAmount?.replace(/[^\d]/g, "") || 0);

      return (
        (!search || bill.name?.toLowerCase().includes(search.toLowerCase())) &&
        (!statusFilter || bill.status === statusFilter) &&
        (!showWithMobile || bill.mobileNo) &&
        (!minAmount || amountToPay >= parseInt(minAmount)) &&
        (!maxAmount || amountToPay <= parseInt(maxAmount)) &&
        (!showWithBill || billAmount > 0)
      );
    });

    if (sortOrder) {
      filtered.sort((a, b) => {
        const aAmt = parseInt(a.amountToPay?.replace(/[^\d]/g, "") || 0);
        const bAmt = parseInt(b.amountToPay?.replace(/[^\d]/g, "") || 0);
        return sortOrder === "asc" ? aAmt - bAmt : bAmt - aAmt;
      });
    }

    setFilteredBills(filtered);
  }, [bills, search, statusFilter, minAmount, maxAmount, showWithMobile, showWithBill, sortOrder]);

  // ✅ Update API call
const handleUpdate = async (id, field, value) => {
  try {
    await axios.put(`/api/bills/${id}`, { [field]: value });

    setBills((prev) =>
      prev.map((b) => (b._id === id ? { ...b, [field]: value } : b))
    );

    // 🎉 Success popup with inline styles
    Swal.fire({
      title:
        "<h3 style='font-size:16px; font-weight:600; margin:0;'>Updated Successfully!</h3>",
      icon: "success",
      position: "center",
      timer: 1800,
      showConfirmButton: false,
      background: "#fff",
      width: "260px",
      didOpen: (popup) => {
        popup.style.borderRadius = "0px"; // Square shape
        popup.style.padding = "1.2rem"; // Inline padding
        popup.style.boxShadow = "0 4px 15px rgba(0, 0, 0, 0.15)";
      },
    });
  } catch (err) {
    console.error("❌ Update failed:", err);

    Swal.fire({
      title:
        "<h3 style='font-size:16px; font-weight:600; margin:0;'>Error while updating!</h3>",
      icon: "error",
      background: "#fff",
      confirmButtonColor: "#d33",
      width: "260px",
      didOpen: (popup) => {
        popup.style.borderRadius = "0px";
        popup.style.padding = "1.2rem";
        popup.style.boxShadow = "0 4px 15px rgba(0, 0, 0, 0.15)";
      },
    });
  }
};


const handleDelete = async (id) => {
  const result = await MySwal.fire({
    title: "Are you sure?",
    text: "This bill will be permanently deleted!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "Yes, delete it",
    cancelButtonText: "Cancel",
    backdrop: true,
  });

  if (result.isConfirmed) {
    try {
      await axios.delete(`/api/bills/${id}`);
      setBills((prev) => prev.filter((b) => b._id !== id));
      MySwal.fire("Deleted!", "The bill has been deleted.", "success");
    } catch {
      MySwal.fire("Error!", "Something went wrong.", "error");
    }
  }
};

  const getStatusIcon = (status) => {
    switch (status) {
      case "success": return <CheckCircle className="w-5 h-5" />;
      case "pending": return <Clock className="w-5 h-5" />;
      case "inprocess": return <AlertCircle className="w-5 h-5" />;
      case "fail": return <XCircle className="w-5 h-5" />;
      default: return <Clock className="w-5 h-5" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "success": return "bg-green-500";
      case "pending": return "bg-yellow-500";
      case "inprocess": return "bg-blue-500";
      case "fail": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getDaysUntilDue = (dueDate) => {
    try {
      const parts = dueDate.split('-');
      const due = new Date(`20${parts[2]}-${getMonthNumber(parts[1])}-${parts[0]}`);
      const today = new Date();
      const diffTime = due - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch {
      return 0;
    }
  };

  const getMonthNumber = (month) => {
    const months = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
      'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    return months[month] || '01';
  };

  const totalAmount = filteredBills.reduce((sum, bill) => 
    sum + parseInt(bill.amountToPay?.replace(/[^\d]/g, "") || 0), 0
  );

  const statusCount = {
    pending: bills.filter(b => b.status === "pending").length,
    success: bills.filter(b => b.status === "success").length,
    inprocess: bills.filter(b => b.status === "inprocess").length,
    fail: bills.filter(b => b.status === "fail").length,
  };

  return (
    <div className={`min-h-screen transition-all duration-500 ${
      theme === "dark" 
        ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" 
        : "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"
    }`}>
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-4 mb-8"
        >
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${theme === "dark" ? "bg-blue-600" : "bg-blue-600"}`}>
              <Receipt className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Billing Dashboard
              </h1>
              <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                Manage customer bills efficiently
              </p>
            </div>
          </div>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg transform hover:scale-105 transition-all duration-300 flex items-center gap-2"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <motion.div 
            whileHover={{ scale: 1.05, y: -5 }}
            className={`p-5 rounded-2xl shadow-lg ${
              theme === "dark" ? "bg-gray-800 border border-gray-700" : "bg-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Total Bills</p>
                <p className={`text-3xl font-bold mt-1 ${theme === "dark" ? "text-white" : ""}`}>{bills.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-gray-200 bg-opacity-10">
                <Receipt className="w-8 h-8 text-blue-500" />
              </div>
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.05, y: -5 }}
            className={`p-5 rounded-2xl shadow-lg ${
              theme === "dark" ? "bg-gray-800 border border-gray-700" : "bg-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Pending</p>
                <p className="text-3xl font-bold mt-1 text-yellow-500">{statusCount.pending}</p>
              </div>
              <div className="p-3 rounded-xl bg-yellow-500 bg-opacity-10">
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.05, y: -5 }}
            className={`p-5 rounded-2xl shadow-lg ${
              theme === "dark" ? "bg-gray-800 border border-gray-700" : "bg-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Success</p>
                <p className="text-3xl font-bold mt-1 text-green-500">{statusCount.success}</p>
              </div>
              <div className="p-3 rounded-xl bg-green-500 bg-opacity-10">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.05, y: -5 }}
            className={`p-5 rounded-2xl shadow-lg ${
              theme === "dark" ? "bg-gray-800 border border-gray-700" : "bg-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>In Process</p>
                <p className="text-3xl font-bold mt-1 text-blue-500">{statusCount.inprocess}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-500 bg-opacity-10">
                <AlertCircle className="w-8 h-8 text-blue-500" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Search and Filter Toggle */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className={`flex-1 relative ${theme === "dark" ? "bg-gray-800" : "bg-white"} rounded-xl shadow-lg`}>
            <Search className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
              theme === "dark" ? "text-gray-400" : "text-gray-500"
            }`} />
            <input
              className={`w-full pl-12 pr-4 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                theme === "dark" ? "bg-gray-800 text-white" : "bg-white"
              }`}
              placeholder="Search by customer name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-6 py-4 rounded-xl shadow-lg flex items-center gap-2 font-semibold transition-all ${
              showFilters 
                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white" 
                : theme === "dark" ? "bg-gray-800 text-white hover:bg-gray-700" : "bg-white hover:bg-gray-50"
            }`}
          >
            <Filter className="w-5 h-5" />
            Filters
          </button>
        </div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className={`mb-6 p-6 rounded-2xl shadow-lg ${
                theme === "dark" ? "bg-gray-800 border border-gray-700" : "bg-white"
              }`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <select
                  className={`p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300"
                  }`}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="inprocess">In Process</option>
                  <option value="success">Success</option>
                  <option value="fail">Fail</option>
                </select>

                <div className="flex gap-2">
                  <input
                    className={`p-3 rounded-xl border w-1/2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300"
                    }`}
                    placeholder="Min ₹"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                  />
                  <input
                    className={`p-3 rounded-xl border w-1/2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300"
                    }`}
                    placeholder="Max ₹"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                  />
                </div>

                <select
                  className={`p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300"
                  }`}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                >
                  <option value="">Sort By Amount</option>
                  <option value="asc">Low to High</option>
                  <option value="desc">High to Low</option>
                </select>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowWithMobile(!showWithMobile)}
                    className={`flex-1 px-4 py-3 rounded-xl transition-all font-medium ${
                      showWithMobile
                        ? "bg-green-500 text-white shadow-lg"
                        : theme === "dark" ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    <Phone className="w-4 h-4 inline mr-1" /> Mobile
                  </button>
                  <button
                    onClick={() => setShowWithBill(!showWithBill)}
                    className={`flex-1 px-4 py-3 rounded-xl transition-all font-medium ${
                      showWithBill
                        ? "bg-green-500 text-white shadow-lg"
                        : theme === "dark" ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    <Receipt className="w-4 h-4 inline mr-1" /> Bill
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Counter */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`mb-6 text-lg ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
        >
          Showing <span className="font-bold text-blue-600">{filteredBills.length}</span> of{" "}
          <span className="font-bold text-purple-600">{bills.length}</span> bills
        </motion.p>

        {/* Bill Cards */}
        <AnimatePresence>
          {filteredBills.length ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredBills.map((bill, index) => {
                const daysUntilDue = getDaysUntilDue(bill.billDueDate);
                const isExpanded = expandedCard === bill._id;
                
                return (
                  <motion.div
                    key={bill._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ y: -8 }}
                    className={`relative rounded-2xl shadow-xl overflow-hidden transition-all duration-300 ${
                      theme === "dark" 
                        ? "bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700" 
                        : "bg-white hover:shadow-2xl"
                    }`}
                  >
                    {/* Status Badge */}
                    <div className={`absolute top-0 right-0 px-4 py-2 rounded-bl-2xl ${getStatusColor(bill.status)} flex items-center gap-2 text-white`}>
                      {getStatusIcon(bill.status)}
                      <span className="font-semibold capitalize text-sm">{bill.status}</span>
                    </div>

                    <div className="p-6">
                      {/* Customer Name */}
                      <h2 className={`text-xl font-bold mb-4 mt-8 pr-20 ${theme === "dark" ? "text-white" : ""}`}>
                        {bill.name}
                      </h2>

                      {/* Key Info Grid */}
                      <div className="space-y-3 mb-4">
                        <div className={`flex items-center gap-3 p-3 rounded-xl ${
                          theme === "dark" ? "bg-gray-700 bg-opacity-50" : "bg-blue-50"
                        }`}>
                          <Receipt className="w-5 h-5 text-blue-500" />
                          <div className="flex-1">
                            <p className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Consumer No.</p>
                            <p className={`font-semibold ${theme === "dark" ? "text-white" : ""}`}>{bill.consumerNumber}</p>
                          </div>
                        </div>

                        <div className={`flex items-center gap-3 p-3 rounded-xl ${
                          theme === "dark" ? "bg-gray-700 bg-opacity-50" : "bg-purple-50"
                        }`}>
                          <Calendar className="w-5 h-5 text-purple-500" />
                          <div className="flex-1">
                            <p className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Bill Month</p>
                            <p className={`font-semibold ${theme === "dark" ? "text-white" : ""}`}>{bill.billMonth}</p>
                          </div>
                        </div>

                        {bill.mobileNo && (
                          <div className={`flex items-center gap-3 p-3 rounded-xl ${
                            theme === "dark" ? "bg-gray-700 bg-opacity-50" : "bg-green-50"
                          }`}>
                            <Phone className="w-5 h-5 text-green-500" />
                            <div className="flex-1">
                              <p className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Mobile</p>
                              <p className={`font-semibold ${theme === "dark" ? "text-white" : ""}`}>{bill.mobileNo}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Amount Highlight */}
                      <div className={`p-5 rounded-xl mb-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white`}>
                        <p className="text-sm opacity-90">Bill Amount</p>
                        <p className="text-4xl font-bold mt-1">{bill.billAmount}</p>
                        <div className="flex items-center gap-2 mt-2 text-sm">
                          <Calendar className="w-4 h-4" />
                          <span>Due: {bill.billDueDate}</span>
                          {daysUntilDue > 0 && (
                            <span className="ml-auto bg-white bg-opacity-20 px-2 py-1 rounded-full text-xs">
                              {daysUntilDue} days left
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Expandable Details */}
                      <button
                        onClick={() => setExpandedCard(isExpanded ? null : bill._id)}
                        className={`w-full py-2 rounded-xl mb-4 font-semibold transition-all ${
                          theme === "dark" ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-gray-100 hover:bg-gray-200"
                        }`}
                      >
                        {isExpanded ? "Show Less ▲" : "Show More Details ▼"}
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-2 mb-4 text-sm"
                          >
                            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                              <span className="text-gray-600 dark:text-gray-400">Billing Unit</span>
                              <span className={`font-semibold text-right ${theme === "dark" ? "text-white" : ""}`}>{bill.billingUnit}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                              <span className="text-gray-600 dark:text-gray-400">Consumption</span>
                              <span className={`font-semibold ${theme === "dark" ? "text-white" : ""}`}>{bill.consumption}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                              <span className="text-gray-600 dark:text-gray-400">Meter Status</span>
                              <span className={`font-semibold ${theme === "dark" ? "text-white" : ""}`}>{bill.meterStatus}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                              <span className="text-gray-600 dark:text-gray-400">Bill Period</span>
                              <span className={`font-semibold ${theme === "dark" ? "text-white" : ""}`}>{bill.billPeriod}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                              <span className="text-gray-600 dark:text-gray-400">Bill Amount</span>
                              <span className={`font-semibold ${theme === "dark" ? "text-white" : ""}`}>{bill.billAmount}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                              <span className="text-gray-600 dark:text-gray-400">After Due Date</span>
                              <span className="font-semibold text-red-500">{bill.billAmountAfterDueDate}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                              <span className="text-gray-600 dark:text-gray-400">Prompt Payment Date</span>
                              <span className="font-semibold text-green-500">{bill.promptPaymentDate}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                              <span className="text-gray-600 dark:text-gray-400">With Prompt Discount</span>
                              <span className="font-semibold text-green-500">{bill.billAmountWithPromptDiscount}</span>
                            </div>
                            <div className="flex justify-between py-2">
                              <span className="text-gray-600 dark:text-gray-400">Bill Date</span>
                              <span className={`font-semibold ${theme === "dark" ? "text-white" : ""}`}>{bill.billDate}</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Status Update */}
                      <div className="mb-4">
                        <label className={`block text-sm font-medium mb-2 ${
                          theme === "dark" ? "text-gray-300" : "text-gray-700"
                        }`}>
                          Update Status
                        </label>
                        <select
                          value={bill.status}
                          onChange={(e) => handleUpdate(bill._id, "status", e.target.value)}
                          className={`w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300"
                          }`}
                        >
                          <option value="pending">Pending</option>
                          <option value="inprocess">In Process</option>
                          <option value="success">Success</option>
                          <option value="fail">Fail</option>
                        </select>
                      </div>

                      {/* Notes */}
                      <div className="relative mb-4">
                        <textarea
                          value={bill.note || ""}
                          onChange={(e) => {
                            setBills((prev) => prev.map((b) => (b._id === bill._id ? { ...b, note: e.target.value } : b)));
                          }}
                          placeholder="Add notes or remarks..."
                          rows="3"
                          className={`w-full p-3 pb-10 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                            theme === "dark" ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-gray-50 border-gray-300"
                          }`}
                        />
                        <button
                          onClick={() => handleUpdate(bill._id, "note", bill.note)}
                          className="absolute bottom-2 right-2 px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-all"
                        >
                          Update
                        </button>
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDelete(bill._id)}
                        className="w-full px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all flex items-center justify-center gap-2 font-semibold shadow-lg hover:shadow-xl"
                      >
                        <Trash2 className="w-5 h-5" />
                        Delete Bill
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`text-center py-16 px-4 rounded-2xl ${
                theme === "dark" ? "bg-gray-800" : "bg-white"
              }`}
            >
              <AlertCircle className={`w-16 h-16 mx-auto mb-4 ${
                theme === "dark" ? "text-gray-600" : "text-gray-400"
              }`} />
              <p className={`text-xl ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                No bills found matching your filters
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default BillPage;