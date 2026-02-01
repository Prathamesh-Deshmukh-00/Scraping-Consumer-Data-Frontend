import React, { useState, useEffect } from "react";
import axios from "axios";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Plus, GripVertical, Trash2, Edit2, CheckCircle, Filter, X, Phone, Calendar, Receipt, AlertCircle, Clock, XCircle, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

const MySwal = withReactContent(Swal);

const FollowUpPage = () => {
    const [stages, setStages] = useState([]);
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [globalFilter, setGlobalFilter] = useState("all"); // all, p1, p2, p3
    const [selectedBill, setSelectedBill] = useState(null);
    const [expandedDetailCard, setExpandedDetailCard] = useState(null);

    // ✅ Fetch Stages & Bills
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const stageRes = await axios.get("/api/stages");
            const billRes = await axios.get("/api/bills");
            setStages(stageRes.data.data);
            setBills(billRes.data.data.filter((b) => b.status === "inprocess"));
            setLoading(false);
        } catch (error) {
            console.error("Error fetching data:", error);
            setLoading(false);
        }
    };

    // ✅ Add New Stage
    const handleAddStage = async () => {
        const { value: name } = await MySwal.fire({
            title: "Add New Stage",
            input: "text",
            inputLabel: "Stage Name",
            inputPlaceholder: "Enter stage name...",
            showCancelButton: true,
            confirmButtonColor: "#3b82f6",
            cancelButtonColor: "#d33",
        });

        if (!name) return;

        try {
            const res = await axios.post("/api/stages", { name });
            setStages([...stages, res.data.data]);
            MySwal.fire("Created!", "New stage has been added.", "success");
        } catch (error) {
            MySwal.fire("Error!", "Failed to create stage.", "error");
        }
    };

    // ✅ Edit Stage Name
    const handleEditStage = async (id, currentName) => {
        const { value: name } = await MySwal.fire({
            title: "Edit Stage Name",
            input: "text",
            inputValue: currentName,
            showCancelButton: true,
            confirmButtonColor: "#3b82f6",
            cancelButtonColor: "#d33",
        });

        if (!name || name === currentName) return;

        try {
            await axios.put(`/api/stages/${id}`, { name });
            setStages(stages.map((s) => (s._id === id ? { ...s, name } : s)));
            MySwal.fire("Updated!", "Stage name has been updated.", "success");
        } catch (error) {
            MySwal.fire("Error!", "Failed to update stage.", "error");
        }
    };

    // ✅ Delete Stage
    const handleDeleteStage = async (id) => {
        const result = await MySwal.fire({
            title: "Delete this Stage?",
            text: "Bills in this stage will be hidden until moved!",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#3085d6",
            confirmButtonText: "Yes, delete it!"
        });

        if (result.isConfirmed) {
            // 1. Calculate Fallback Stage (Logic matches backend)
            const stageIndex = stages.findIndex(s => s._id === id);
            let fallbackStageId = null;

            if (stageIndex > 0) {
                fallbackStageId = stages[stageIndex - 1]._id;
            } else if (stages.length > 1) {
                fallbackStageId = stages[stageIndex + 1]._id;
            }

            // 2. Optimistic Update: Move Bills
            const updatedBills = bills.map(b =>
                b.stageId === id ? { ...b, stageId: fallbackStageId } : b
            );
            setBills(updatedBills);

            // 3. Optimistic Update: Remove Stage
            const previousStages = [...stages];
            setStages(stages.filter((s) => s._id !== id));

            try {
                const res = await axios.delete(`/api/stages/${id}`);
                // Use backend response if needed, but optimistic is usually fine
                MySwal.fire("Deleted!", "Stage has been deleted.", "success");
            } catch (error) {
                // Revert on error
                setStages(previousStages);
                fetchData(); // Re-fetch to be safe
                MySwal.fire("Error!", "Failed to delete stage.", "error");
            }
        }
    };

    // ✅ Update Priority directly on Card
    const updatePriority = async (billId, newPriority) => {
        console.log(`🔄 Updating Priority for Bill ID: ${billId} to ${newPriority}`);

        // Optimistic Update
        setBills(prevBills => prevBills.map(b => b._id === billId ? { ...b, priority: newPriority } : b));

        try {
            await axios.put(`/api/bills/${billId}`, { priority: newPriority });
        } catch (error) {
            console.error("Failed to update priority", error);
            MySwal.fire({
                icon: 'error',
                title: 'Update Failed',
                text: 'Could not update priority',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        }
    };

    // ✅ Update Status
    const updateStatus = async (billId, newStatus) => {
        try {
            await axios.put(`/api/bills/${billId}`, { status: newStatus });

            if (newStatus === "inprocess") {
                setBills(prev => prev.map(b => b._id === billId ? { ...b, status: newStatus } : b));
                setSelectedBill(prev => ({ ...prev, status: newStatus }));
            } else {
                setBills(prev => prev.filter(b => b._id !== billId));
                setSelectedBill(null);
                MySwal.fire({
                    icon: 'success',
                    title: 'Status Updated',
                    text: `Bill moved to ${newStatus}`,
                    timer: 1500,
                    showConfirmButton: false,
                    position: 'center'
                });
            }
        } catch (error) {
            console.error("Failed to update status", error);
            MySwal.fire("Error", "Could not update status", "error");
        }
    };


    // ✅ Drag End Logic
    const scrollContainerRef = React.useRef(null);
    const isDraggingRef = React.useRef(false); // Ref instead of state
    const autoScrollSpeedRef = React.useRef(0);

    const onDragStart = () => {
        isDraggingRef.current = true;
    };

    const onDragEnd = async (result) => {
        isDraggingRef.current = false;
        autoScrollSpeedRef.current = 0;

        const { destination, source, draggableId } = result;
        if (!destination) return;
        if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
        )
            return;

        // Optimistic UI Update
        const newStageId = destination.droppableId;
        const updatedBills = bills.map((b) =>
            b._id === draggableId ? { ...b, stageId: newStageId } : b
        );
        setBills(updatedBills);

        // Call API
        try {
            await axios.put(`/api/bills/${draggableId}`, { stageId: newStageId });
        } catch (error) {
            console.error("Failed to update stage:", error);
        }
    };

    // ⚡ Custom Auto-Scroll Hook Logic (Renderless)
    useEffect(() => {
        let animationFrameId;

        const handleAutoScroll = () => {
            if (isDraggingRef.current && scrollContainerRef.current && autoScrollSpeedRef.current !== 0) {
                scrollContainerRef.current.scrollLeft += autoScrollSpeedRef.current;
                // ⚡ FORCE UPDATE: Tell dnd library that scroll happened immediately
                scrollContainerRef.current.dispatchEvent(new Event('scroll'));
            }
            animationFrameId = requestAnimationFrame(handleAutoScroll);
        };

        const handleMouseMove = (e) => {
            if (!isDraggingRef.current || !scrollContainerRef.current) return;

            const { innerWidth } = window;
            const edgeThreshold = 250;
            const maxSpeed = 25; // ⚡ Balanced Speed (Fast but accurate)

            if (e.clientX < edgeThreshold) {
                // Scroll Left
                const intensity = (edgeThreshold - e.clientX) / edgeThreshold;
                autoScrollSpeedRef.current = -(maxSpeed * intensity);
            } else if (e.clientX > innerWidth - edgeThreshold) {
                // Scroll Right
                const intensity = (e.clientX - (innerWidth - edgeThreshold)) / edgeThreshold;
                autoScrollSpeedRef.current = maxSpeed * intensity;
            } else {
                autoScrollSpeedRef.current = 0;
            }
        };

        window.addEventListener("mousemove", handleMouseMove);
        // Start loop immediately, it only acts if flags are true
        animationFrameId = requestAnimationFrame(handleAutoScroll);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    // Group bills by stage and filter
    const getBillsForStage = (stageId) => {
        // 1. Assign unassigned to first stage
        const isFirstStage = stages.length > 0 && stages[0]._id === stageId;
        let stageBills = bills.filter(
            (b) => b.stageId === stageId || (isFirstStage && !b.stageId)
        );

        // 2. Apply Global Filter
        if (globalFilter !== 'all') {
            stageBills = stageBills.filter(b => b.priority === globalFilter);
        }

        // 3. Sort by priority (Robust & Case-Insensitive)
        return stageBills.sort((a, b) => {
            const priorities = { p1: 3, p2: 2, p3: 1, none: 0 };
            const pA = priorities[(a.priority || "none").toLowerCase()] || 0;
            const pB = priorities[(b.priority || "none").toLowerCase()] || 0;
            return pB - pA;
        });
    };

    // Helper colors
    const getStageColor = (index) => {
        const colors = [
            "border-t-blue-500",
            "border-t-purple-500",
            "border-t-green-500",
            "border-t-yellow-500",
            "border-t-orange-500",
            "border-t-pink-500",
            "border-t-indigo-500",
        ];
        return colors[index % colors.length];
    };

    const getPriorityBadge = (priority) => {
        switch (priority) {
            case "p1": return <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-bold shadow-sm">🔥 P1</span>;
            case "p2": return <span className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full font-bold shadow-sm">⚡ P2</span>;
            case "p3": return <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-bold shadow-sm">🔹 P3</span>;
            default: return <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full font-bold border border-gray-200">No Priority</span>;
        }
    };

    // 🛠 Helpers for Detail Modal
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

    const getMonthNumber = (month) => {
        const months = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
            'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        };
        return months[month] || '01';
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

    if (loading) return <div className="p-10 text-center animate-pulse">Loading Pipeline...</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] bg-gray-50 dark:bg-gray-900">

            {/* 🔹 Top Bar: Global Filters */}
            <div className="px-6 py-4 bg-white dark:bg-gray-800 shadow-sm flex flex-col sm:flex-row gap-4 sm:gap-0 items-center justify-between z-20">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
                    🚀 Pipeline Manager
                    <span className="text-xs font-normal bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full text-gray-500">
                        {bills.length} Deals
                    </span>
                </h2>

                <div className="flex gap-2">
                    <span className="text-sm text-gray-500 self-center mr-2 font-medium">Filter Priority:</span>
                    {[
                        { id: "all", label: `All (${bills.length})`, color: "bg-gray-200 text-gray-700" },
                        { id: "p1", label: `🔥 P1 (${bills.filter(b => b.priority === "p1").length})`, color: "bg-red-100 text-red-700" },
                        { id: "p2", label: `⚡ P2 (${bills.filter(b => b.priority === "p2").length})`, color: "bg-orange-100 text-orange-700" },
                        { id: "p3", label: `🔹 P3 (${bills.filter(b => b.priority === "p3").length})`, color: "bg-blue-100 text-blue-700" },
                    ].map(filter => (
                        <button
                            key={filter.id}
                            onClick={() => setGlobalFilter(filter.id)}
                            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${globalFilter === filter.id
                                ? "ring-2 ring-blue-500 ring-offset-2 scale-105 shadow-md " + filter.color.replace('bg-gray-200', 'bg-gray-800 text-white')
                                : filter.color + " hover:opacity-80"
                                }`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 🔹 Kanban Board */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-x-auto p-6"
            >
                <div className="flex gap-6 h-full min-w-max pb-4">
                    <DragDropContext onDragEnd={onDragEnd} onDragStart={onDragStart}>
                        {stages.map((stage, index) => (
                            <div
                                key={stage._id}
                                className={`w-80 flex flex-col h-full bg-gray-100 dark:bg-gray-800 rounded-xl shadow-lg border-t-4 ${getStageColor(index)} flex-shrink-0`}
                            >
                                {/* Column Header */}
                                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-850 rounded-t-lg">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-gray-800 dark:text-gray-100">{stage.name}</h3>
                                        <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs px-2 py-0.5 rounded-full font-mono">
                                            {getBillsForStage(stage._id).length}
                                        </span>
                                    </div>

                                    <div className="flex gap-1 opacity-100 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEditStage(stage._id, stage.name)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-blue-500">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDeleteStage(stage._id)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-red-500">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Droppable Area */}
                                <Droppable droppableId={stage._id}>
                                    {(provided, snapshot) => (
                                        <div
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                            className={`flex-1 p-3 min-h-[150px] overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 ${snapshot.isDraggingOver ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                                                }`}
                                        >
                                            {getBillsForStage(stage._id).map((bill, idx) => (
                                                <Draggable
                                                    key={bill._id}
                                                    draggableId={bill._id}
                                                    index={idx}
                                                >
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            onClick={() => setSelectedBill(bill)}
                                                            className={`p-4 bg-white dark:bg-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all border border-transparent dark:border-gray-600 group relative cursor-pointer ${snapshot.isDragging ? "rotate-2 scale-105 shadow-2xl z-50 ring-2 ring-blue-500" : ""
                                                                } ${bill.priority === 'p1' ? 'border-l-4 border-l-red-500' : ''}`}
                                                            style={{ ...provided.draggableProps.style }}
                                                        >

                                                            <div className="flex justify-between items-start mb-3">
                                                                <h4 className="font-bold text-gray-800 dark:text-white line-clamp-2 leading-tight flex-1 mr-2">
                                                                    {bill.name}
                                                                </h4>
                                                                {/* Priority Dropdown */}
                                                                <div
                                                                    className="relative z-10 shrink-0"
                                                                    onPointerDown={(e) => e.stopPropagation()}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <select
                                                                        value={bill.priority || "none"}
                                                                        onChange={(e) => {
                                                                            e.stopPropagation();
                                                                            updatePriority(bill._id, e.target.value);
                                                                        }}
                                                                        className={`appearance-none text-xs font-bold px-3 py-1.5 rounded-full cursor-pointer transition-all outline-none border-0 shadow-sm hover:shadow-md text-center ${bill.priority === 'p1' ? 'bg-red-100 text-red-700 hover:bg-red-200' :
                                                                            bill.priority === 'p2' ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' :
                                                                                bill.priority === 'p3' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
                                                                                    'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                                            }`}
                                                                        style={{ textAlignLast: 'center' }}
                                                                    >
                                                                        <option value="none">⚪ Normal</option>
                                                                        <option value="p1">🔥 P1</option>
                                                                        <option value="p2">⚡ P2</option>
                                                                        <option value="p3">🔹 P3</option>
                                                                    </select>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-1">
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 font-mono">
                                                                    🆔 {bill.consumerNumber || "No ID"}
                                                                </p>
                                                                <p className="text-lg font-bold text-gray-700 dark:text-gray-200 tracking-tight">
                                                                    {bill.billAmount || "₹0"}
                                                                </p>
                                                            </div>

                                                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-600 flex justify-between text-xs text-gray-400">
                                                                <span>📅 {bill.billDate || "No Date"}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </div>
                        ))}
                    </DragDropContext>

                    {/* Add Stage Button */}
                    <button
                        onClick={handleAddStage}
                        className="w-80 h-16 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-400 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all shrink-0 font-medium"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Add New Pipeline Stage
                    </button>
                </div>
            </div>

            {/* 🔹 Bill Details Modal */}
            <AnimatePresence>
                {selectedBill && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedBill(null)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                        >
                            <div className="relative">
                                {/* Status Badge */}
                                <div className={`absolute top-0 right-0 px-6 py-2 rounded-bl-2xl ${getStatusColor(selectedBill.status)} flex items-center gap-2 text-white z-10`}>
                                    {getStatusIcon(selectedBill.status)}
                                    <span className="font-semibold capitalize text-sm">{selectedBill.status}</span>
                                </div>

                                <div className="p-6 pt-12">
                                    <button
                                        onClick={() => setSelectedBill(null)}
                                        className="absolute top-4 left-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                                    >
                                        <X className="w-5 h-5 text-gray-500 dark:text-gray-300" />
                                    </button>

                                    {/* Customer Name */}
                                    <h2 className="text-2xl font-bold mb-6 mt-2 text-gray-800 dark:text-white">
                                        {selectedBill.name}
                                    </h2>

                                    {/* Key Info Grid */}
                                    <div className="space-y-3 mb-6">
                                        <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-gray-700/50">
                                            <Receipt className="w-5 h-5 text-blue-500" />
                                            <div className="flex-1">
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Consumer No.</p>
                                                <p className="font-semibold text-gray-800 dark:text-white">{selectedBill.consumerNumber}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 dark:bg-gray-700/50">
                                            <Calendar className="w-5 h-5 text-purple-500" />
                                            <div className="flex-1">
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Bill Month</p>
                                                <p className="font-semibold text-gray-800 dark:text-white">{selectedBill.billMonth}</p>
                                            </div>
                                        </div>

                                        {selectedBill.mobileNo && (
                                            <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-gray-700/50">
                                                <Phone className="w-5 h-5 text-green-500" />
                                                <div className="flex-1">
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">Mobile</p>
                                                    <p className="font-semibold text-gray-800 dark:text-white">{selectedBill.mobileNo}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Amount Highlight */}
                                    <div className="p-5 rounded-xl mb-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
                                        <p className="text-sm opacity-90">Bill Amount</p>
                                        <p className="text-4xl font-bold mt-1">{selectedBill.billAmount}</p>
                                        <div className="flex items-center gap-2 mt-2 text-sm">
                                            <Calendar className="w-4 h-4" />
                                            <span>Due: {selectedBill.billDueDate}</span>
                                            {getDaysUntilDue(selectedBill.billDueDate) > 0 && (
                                                <span className="ml-auto bg-white/20 px-2 py-1 rounded-full text-xs">
                                                    {getDaysUntilDue(selectedBill.billDueDate)} days left
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Full Details Always Visible in Popup */}
                                    <div className="space-y-3 mb-6 text-sm bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                            <span className="text-gray-500 dark:text-gray-400">Billing Unit</span>
                                            <span className="font-semibold text-gray-800 dark:text-white">{selectedBill.billingUnit}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                            <span className="text-gray-500 dark:text-gray-400">Consumption</span>
                                            <span className="font-semibold text-gray-800 dark:text-white">{selectedBill.consumption}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                            <span className="text-gray-500 dark:text-gray-400">Meter Status</span>
                                            <span className="font-semibold text-gray-800 dark:text-white">{selectedBill.meterStatus}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                            <span className="text-gray-500 dark:text-gray-400">Bill Period</span>
                                            <span className="font-semibold text-gray-800 dark:text-white">{selectedBill.billPeriod}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                            <span className="text-gray-500 dark:text-gray-400">After Due Date</span>
                                            <span className="font-semibold text-red-500">{selectedBill.billAmountAfterDueDate}</span>
                                        </div>
                                        <div className="flex justify-between py-2">
                                            <span className="text-gray-500 dark:text-gray-400">Notes</span>
                                            <span className="font-semibold text-gray-800 dark:text-white max-w-[50%] text-right truncate">{selectedBill.note || "No notes"}</span>
                                        </div>
                                    </div>

                                    {/* Status Update */}
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                            Stage Status
                                        </label>
                                        <select
                                            value={selectedBill.status}
                                            onChange={(e) => updateStatus(selectedBill._id, e.target.value)}
                                            className="w-full p-3 rounded-xl border bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-800 dark:text-gray-200"
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="inprocess">In Process (Pipeline)</option>
                                            <option value="success">Success (Completed)</option>
                                            <option value="fail">Fail (Dropped)</option>
                                        </select>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => window.location.href = `tel:${selectedBill.mobileNo}`}
                                            className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold shadow-md transition-all flex items-center justify-center gap-2"
                                            disabled={!selectedBill.mobileNo}
                                        >
                                            <Phone className="w-5 h-5" /> Call
                                        </button>
                                        <button
                                            onClick={() => setSelectedBill(null)}
                                            className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-xl font-semibold transition-all"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default FollowUpPage;
