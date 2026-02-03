import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, X, Check, ArrowRight, ArrowLeft, Loader, Plus, Minus, RotateCcw } from 'lucide-react';

const PhotoUploadApp = () => {
  const [screen, setScreen] = useState('home'); // home, camera, uploading, success
  const [photos, setPhotos] = useState([]);
  const [selectedPhotos, setSelectedPhotos] = useState(new Set());
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [stream, setStream] = useState(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [fullScreenPhoto, setFullScreenPhoto] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [showPreviewPopup, setShowPreviewPopup] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const longPressTimer = useRef(null);
  
  // Drag and Drop state
  const [isDragging, setIsDragging] = useState(false);
  const nativeCameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // Unified file processor
  const processFiles = (files) => {
    const newPhotos = files.map(file => ({
      id: Date.now() + Math.random(),
      blob: file,
      url: URL.createObjectURL(file)
    }));
    setPhotos(prev => [...prev, ...newPhotos]);
    setSelectedPhotos(prev => {
      const newSet = new Set(prev);
      newPhotos.forEach(p => newSet.add(p.id));
      return newSet;
    });
  };

  // Handle Drag & Drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (files.length > 0) {
      processFiles(files);
    }
  };

  // Handle Paste
  useEffect(() => {
    const handlePaste = (e) => {
      if (screen === 'home') {
        const items = e.clipboardData.items;
        const files = [];
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            files.push(items[i].getAsFile());
          }
        }
        if (files.length > 0) {
          processFiles(files);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [screen]);

  // Start camera with proper initialization
  const startCamera = async () => {
    setCameraLoading(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      setStream(mediaStream);
      setScreen('camera');

      // Wait for video to be ready
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            resolve();
          };
        });
      }
      setCameraLoading(false);
    } catch (err) {
      setCameraLoading(false);
      alert('Camera access denied or not available');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  // Capture photo
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      canvas.toBlob((blob) => {
        const newPhoto = {
          id: Date.now() + Math.random(),
          blob,
          url: URL.createObjectURL(blob)
        };
        setPhotos(prev => [...prev, newPhoto]);
        setSelectedPhotos(prev => new Set([...prev, newPhoto.id]));
      }, 'image/jpeg', 0.9);
    }
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    if (e.target.files?.length > 0) {
      processFiles(Array.from(e.target.files));
    }
    // ensure we can select same file again
    e.target.value = '';
  };

  // Long press handlers for photo selection
  const handleTouchStart = (photoId) => {
    if (!selectionMode) {
      longPressTimer.current = setTimeout(() => {
        setSelectionMode(true);
        togglePhotoSelection(photoId);
      }, 500); // 500ms long press
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  // Toggle photo selection
  const togglePhotoSelection = (photoId) => {
    setSelectedPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  // Handle photo click (tap in selection mode or long press)
  const handlePhotoClick = (photoId) => {
    if (selectionMode) {
      togglePhotoSelection(photoId);
    }
  };

  const [extractionResult, setExtractionResult] = useState(null); // Full report from backend
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ... (existing refs)

  // Fetch History
  const fetchHistory = async () => {
    setHistoryLoading(true);
    setShowHistory(true);
    try {
      const backendURL = import.meta.env.VITE_BACKEND_URL || "";
      const res = await fetch(`${backendURL}/api/history`);
      const data = await res.json();
      if (data.success) {
        setHistoryData(data.history);
      }
    } catch (err) {
      console.error("Failed to fetch history", err);
    } finally {
      setHistoryLoading(false);
    }
  };

 // ... (existing drag/drop handlers) ... 

  // Upload photos SEQUENTIALLY to show accurate progress
  const uploadPhotos = async () => {
    const selectedPhotosList = photos.filter(p => selectedPhotos.has(p.id));
    const total = selectedPhotosList.length;
    setUploadProgress({ current: 0, total });
    setShowPreviewPopup(false);
    setScreen('uploading');

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const backendURL = import.meta.env.VITE_BACKEND_URL || "";
    
    // Accumulator for final report
    const finalReport = {
        success: [],
        failed: [],
        stats: {
           total: 0,
           success: 0,
           duplicate: 0,
           failed: 0,
           firstAttemptSuccess: 0,
           retrySuccess: 0
        } 
    };

    try {
        for (let i = 0; i < total; i++) {
           const photo = selectedPhotosList[i];
           const formData = new FormData();
           formData.append('images', photo.blob, `photo_${i}.jpg`);
           formData.append('batchId', batchId); // Send batch ID for grouping

           try {
              const res = await fetch(`${backendURL}/api/upload-images`, {
                  method: 'POST',
                  body: formData
              });
              const data = await res.json();

              if (data.success && data.extractionReport) {
                  const rep = data.extractionReport;
                  // Merge results
                  finalReport.success.push(...(rep.success || []));
                  finalReport.failed.push(...(rep.failed || []));
                  
                  // Accumulate stats (backend sends stats for THIS file, but we want cumulative? 
                  // actually backend handles DB accum, but frontend needs local accum for display)
                  // Since we are getting the report for *just this file*, we just add to our totals.
                  
                  if (rep.stats) {
                      finalReport.stats.total += rep.stats.total || 0;
                      finalReport.stats.success += rep.stats.success || 0;
                      finalReport.stats.duplicate += rep.stats.duplicate || 0; // New field
                      finalReport.stats.failed += rep.stats.failed || 0;
                      finalReport.stats.firstAttemptSuccess += rep.stats.firstAttemptSuccess || 0;
                      finalReport.stats.retrySuccess += rep.stats.retrySuccess || 0;
                  }
              }
           } catch (err) {
               console.error("Single file upload failed", err);
               finalReport.stats.failed++;
               finalReport.failed.push({ file: `photo_${i}.jpg`, reason: "Network Error" });
           }

           // Update Progress UI
           setUploadProgress({ current: i + 1, total });
        }

        setExtractionResult(finalReport); // Store full accumulated report
        setScreen('success');

    } catch (error) {
        alert('Batch process interrupted: ' + error.message);
        setScreen('camera');
    }
  };

  // Reset app
  const resetApp = () => {
    photos.forEach(photo => URL.revokeObjectURL(photo.url));
    setPhotos([]);
    setSelectedPhotos(new Set());
    setUploadProgress({ current: 0, total: 0 });
    setSelectionMode(false);
    setShowPreviewPopup(false);
    setFullScreenPhoto(null);
    setExtractionResult(null);
    setScreen('home');
  };

  // Home Screen
  if (screen === 'home') {
    return (
      <div 
        className={`min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300 flex flex-col items-center justify-center p-6 ${isDragging ? 'bg-blue-50 dark:bg-gray-800' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className={`w-full max-w-lg space-y-8 animate-fade-in transition-all duration-300 ${isDragging ? 'scale-105 opacity-50' : ''}`}>
          
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
              Photo Uploader
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Upload photos from gallery, camera, or drag & drop
            </p>
          </div>

          {/* Upload Options Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Custom Camera */}
            <button
              onClick={startCamera}
              className="group relative overflow-hidden bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md hover:shadow-xl border border-gray-100 dark:border-gray-700 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex flex-col items-center space-y-3 relative z-10">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                  <Camera size={32} />
                </div>
                <span className="font-semibold text-gray-800 dark:text-gray-200">Custom Cam</span>
              </div>
            </button>

             {/* Native Camera */}
             <button
              onClick={() => nativeCameraInputRef.current?.click()}
              className="group relative overflow-hidden bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md hover:shadow-xl border border-gray-100 dark:border-gray-700 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex flex-col items-center space-y-3 relative z-10">
                <div className="p-3 bg-cyan-100 dark:bg-cyan-900/30 rounded-full text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform">
                  <Camera size={32} />
                </div>
                 <span className="font-semibold text-gray-800 dark:text-gray-200">Native Cam</span>
              </div>
            </button>


            {/* Gallery Selection */}
            <button
              onClick={() => galleryInputRef.current?.click()}
              className="md:col-span-2 group relative overflow-hidden bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md hover:shadow-xl border border-gray-100 dark:border-gray-700 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex flex-col items-center space-y-3 relative z-10">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-full text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                  <Upload size={32} />
                </div>
                <div className="text-center">
                  <span className="block font-semibold text-gray-800 dark:text-gray-200 text-lg">Select from Gallery</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">Supports JPG, PNG, HEIC</span>
                </div>
              </div>
            </button>

            {/* History Button */}
            <button
               onClick={fetchHistory}
               className="md:col-span-2 group relative overflow-hidden bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md hover:shadow-xl border border-gray-100 dark:border-gray-700 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex flex-col items-center space-y-3 relative z-10">
                 <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                   <RotateCcw size={32} />
                 </div>
                 <span className="font-semibold text-gray-800 dark:text-gray-200">View History</span>
              </div>
            </button>
          </div>

          {/* Hidden Inputs */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <input
            ref={nativeCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          {/* Drag & Drop Hint */}
          <div className="hidden md:flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 text-gray-400 dark:text-gray-500">
             <span className="">Or drag and drop photos here (or Paste)</span>
          </div>

        </div>

        {/* 🔹 Inline Preview & Upload Section */}
        {photos.length > 0 && (
          <div className="w-full max-w-4xl mt-12 animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                Selected Photos <span className="text-blue-500">({selectedPhotos.size})</span>
              </h3>
              <button
                onClick={() => {
                  setPhotos([]);
                  setSelectedPhotos(new Set());
                }}
                className="text-red-500 hover:text-red-700 font-medium px-3 py-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Clear All
              </button>
            </div>

            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 md:grid-cols-6 gap-4 mb-8">
              {photos.map(photo => (
                <div 
                  key={photo.id} 
                  className="relative aspect-square group cursor-pointer"
                  onClick={() => setFullScreenPhoto(photo)}
                >
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors z-10 rounded-xl" />
                  <img
                    src={photo.url}
                    alt="Preview"
                    className="w-full h-full object-cover rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPhotos(prev => prev.filter(p => p.id !== photo.id));
                      setSelectedPhotos(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(photo.id);
                        return newSet;
                      });
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-md hover:bg-red-600 transition-colors z-20 scale-0 group-hover:scale-100 duration-200"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              
              {/* Add More Button */}
              <button 
                onClick={() => galleryInputRef.current?.click()}
                className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-400 hover:text-blue-500 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-800 transition-all"
              >
                <Upload size={24} />
                <span className="text-xs font-medium mt-1">Add</span>
              </button>
            </div>

            <button
              onClick={uploadPhotos}
              disabled={selectedPhotos.size === 0}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-5 rounded-2xl font-bold shadow-xl shadow-blue-500/20 text-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              <Upload size={28} />
              Upload {selectedPhotos.size} Photos Now
            </button>
          </div>
        )}

        {/* Full Screen Photo View */}
        {fullScreenPhoto && (
          <FullScreenViewer 
            photo={fullScreenPhoto} 
            onClose={() => setFullScreenPhoto(null)} 
          />
        )}

        {/* History Modal */}
        {showHistory && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-white dark:bg-gray-900 w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in border border-gray-200 dark:border-gray-800">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                   <h3 className="text-xl font-bold text-gray-800 dark:text-white">Upload History</h3>
                   <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">
                      <X size={20} />
                   </button>
                </div>
                <div className="p-0 overflow-y-auto flex-1">
                   {historyLoading ? (
                      <div className="flex justify-center p-8"><Loader className="animate-spin text-blue-500" /></div>
                   ) : historyData.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">No history found.</div>
                   ) : (
                      <div className="divide-y dark:divide-gray-800">
                        {historyData.map((item) => (
                          <div key={item._id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                             <div className="flex justify-between items-start mb-2">
                                <div>
                                   <div className="text-sm text-gray-500 font-medium">
                                      {new Date(item.timestamp).toLocaleString()}
                                   </div>
                                   <div className="text-lg font-bold text-gray-800 dark:text-gray-200">
                                      {item.successCount} / {item.totalImages} Success
                                   </div>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  item.failedCount === 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                }`}>
                                   {item.failedCount === 0 ? 'Perfect' : `${item.failedCount} Failed`}
                                </div>
                             </div>
                             <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400 mt-2">
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                                   <span className="block font-semibold text-blue-700 dark:text-blue-300">1st Attempt</span>
                                   {item.firstAttemptSuccessCount} images
                                </div>
                                <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                                   <span className="block font-semibold text-purple-700 dark:text-purple-300">Retried</span>
                                   {item.retrySuccessCount} images
                                </div>
                             </div>
                             {item.failures.length > 0 && (
                                <div className="mt-3 bg-red-50 dark:bg-red-900/10 p-3 rounded-lg">
                                  <p className="text-xs font-bold text-red-700 mb-1">Failures:</p>
                                  <ul className="list-disc list-inside text-xs text-red-600 space-y-1">
                                    {item.failures.map((f, idx) => (
                                      <li key={idx} className="truncate">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">{f.filename}:</span> {f.reason}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                             )}

                             {/* Duplicate Details */}
                             {item.duplicates && item.duplicates.length > 0 && (
                                <div className="mt-3 bg-orange-50 dark:bg-orange-900/10 p-3 rounded-lg">
                                  <p className="text-xs font-bold text-orange-700 mb-1">Duplicates Found:</p>
                                  <ul className="list-disc list-inside text-xs text-orange-600 space-y-1">
                                    {item.duplicates.map((d, idx) => (
                                      <li key={idx} className="truncate">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">{d.filename}</span>
                                        <span className="text-gray-500 ml-1">({d.consumerNumber})</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                             )}
                          </div>
                        ))}
                      </div>
                   )}
                </div>
             </div>
          </div>
        )}

      </div>
    );
  }

  // Camera Screen
  if (screen === 'camera') {
     // ... (camera implementation remains same) ...
     // We just render previous component's return for camera to avoid cutting code
     return (
       <div className="min-h-screen bg-white dark:bg-gray-900 p-4">
         {/* ... (Camera UI content) ... */}
         {/* Re-implement Camera UI quickly to match current state since standard implementation is preserved elsewhere */}
         <div className="max-w-2xl mx-auto">
           {/* Header */}
           <div className="flex items-center justify-between mb-4">
             <button
               onClick={() => {
                 stopCamera();
                 resetApp();
               }}
               className="text-gray-700 hover:text-gray-900 flex items-center space-x-2 bg-white px-4 py-2 rounded-lg shadow"
             >
               <ArrowLeft size={20} />
               <span>Back</span>
             </button>
             <h2 className="text-xl font-bold text-gray-800 dark:text-white">Camera</h2>
             <div className="w-20"></div>
           </div>
 
           {/* Camera View */}
           <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl mb-4">
             {cameraLoading && (
               <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                 <Loader size={48} className="text-white animate-spin" />
               </div>
             )}
             <video
               ref={videoRef}
               autoPlay
               playsInline
               muted
               className="w-full aspect-[3/4] object-cover"
             />
             <canvas ref={canvasRef} className="hidden" />
 
             {/* Bottom Controls Overlay */}
             <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
               <div className="flex items-end justify-between">
                 {/* Photo Counter */}
                 <button
                   onClick={() => photos.length > 0 && setShowPreviewPopup(true)}
                   className="flex flex-col space-y-2"
                   disabled={photos.length === 0}
                 >
                   <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-white text-sm font-medium">
                     {photos.length} Photo{photos.length !== 1 ? 's' : ''}
                   </div>
                   {photos.length > 0 && (
                     <div className="flex space-x-1">
                       {photos.slice(-3).reverse().map((photo, idx) => (
                         <div
                           key={photo.id}
                           className="w-12 h-12 rounded-lg overflow-hidden border-2 border-white shadow-lg"
                           style={{ marginLeft: idx > 0 ? '-8px' : '0' }}
                         >
                           <img
                             src={photo.url}
                             alt="Thumbnail"
                             className="w-full h-full object-cover"
                           />
                         </div>
                       ))}
                     </div>
                   )}
                 </button>
 
                 {/* Capture Button */}
                 <button
                   onClick={capturePhoto}
                   className="w-20 h-20 rounded-full bg-white border-4 border-gray-300 shadow-lg active:scale-95 transition-transform flex-shrink-0"
                 />
 
                 {/* Spacer */}
                 <div className="w-20"></div>
               </div>
             </div>
           </div>
         </div>
         {/* Preview Popup (Existing Logic) */}
          {showPreviewPopup && (
           <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
             <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
               {/* Header */}
               <div className="flex items-center justify-between p-4 border-b">
                 <h3 className="text-xl font-bold text-gray-800">
                   {selectionMode ? 'Select Photos' : 'Your Photos'}
                 </h3>
                 <div className="flex items-center space-x-4">
                   {selectionMode && (
                     <span className="text-sm font-medium text-gray-600">
                       {selectedPhotos.size} selected
                     </span>
                   )}
                   <button
                     onClick={() => {
                       setShowPreviewPopup(false);
                       setSelectionMode(false);
                     }}
                     className="text-gray-500 hover:text-gray-700"
                   >
                     <X size={24} />
                   </button>
                 </div>
               </div>
 
               {/* Grid */}
               <div className="flex-1 overflow-y-auto p-4">
                 <div className="grid grid-cols-3 gap-2">
                   {photos.map(photo => {
                     const isSelected = selectedPhotos.has(photo.id);
                     return (
                       <div
                         key={photo.id}
                         onClick={() => handlePhotoClick(photo.id)}
                         onTouchStart={() => handleTouchStart(photo.id)}
                         onTouchEnd={handleTouchEnd}
                         onMouseDown={() => handleTouchStart(photo.id)}
                         onMouseUp={handleTouchEnd}
                         onMouseLeave={handleTouchEnd}
                         className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${selectionMode
                           ? isSelected
                             ? 'ring-4 ring-blue-500 scale-100'
                             : 'opacity-50 scale-95'
                           : 'hover:scale-105'
                           }`}
                       >
                         <img
                           src={photo.url}
                           alt="Preview"
                           className="w-full h-full object-cover"
                           onClick={(e) => {
                             if (!selectionMode) {
                               e.stopPropagation();
                               setFullScreenPhoto(photo);
                             }
                           }}
                         />
                         {selectionMode && isSelected && (
                           <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                             <Check size={16} />
                           </div>
                         )}
                       </div>
                     );
                   })}
                 </div>
               </div>
 
               {/* Footer */}
               <div className="p-4 border-t space-y-2">
                 {!selectionMode && (
                   <button
                     onClick={() => setSelectionMode(true)}
                     className="w-full bg-blue-500 text-white py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors"
                   >
                     Select Photos to Upload
                   </button>
                 )}
                 {selectionMode && (
                   <button
                     onClick={uploadPhotos}
                     disabled={selectedPhotos.size === 0}
                     className="w-full bg-gradient-to-r from-green-500 to-green-600 disabled:from-gray-400 disabled:to-gray-500 text-white py-3 rounded-xl font-semibold disabled:cursor-not-allowed hover:shadow-lg transition-all"
                   >
                     Upload {selectedPhotos.size} Photo{selectedPhotos.size !== 1 ? 's' : ''}
                   </button>
                 )}
               </div>
             </div>
           </div>
         )}
         {fullScreenPhoto && (
           <FullScreenViewer 
             photo={fullScreenPhoto} 
             onClose={() => setFullScreenPhoto(null)} 
           />
         )}
       </div>
     );
  }

  // Uploading Screen
  if (screen === 'uploading') {
    // ... (keep generic uploading)
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 space-y-6 text-center">
            <Loader size={48} className="text-blue-600 animate-spin mx-auto" />
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
               Processing {uploadProgress.current} of {uploadProgress.total} Images...
            </h2>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
               <div 
                 className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                 style={{ width: `${(uploadProgress.current / (uploadProgress.total || 1)) * 100}%` }}
               />
            </div>

            <p className="text-gray-500 dark:text-gray-400">Extracting consumer numbers with AI...</p>
        </div>
      </div>
    );
  }

  // Success / Report Screen
  if (screen === 'success' && extractionResult?.stats) {
    const { total, success, failed, firstAttemptSuccess, retrySuccess, duplicate } = extractionResult.stats;
    const failures = extractionResult.failed || [];
    const duplicatesCount = duplicate || 0;
    
    // Calculate percentage
    const successRate = total > 0 ? Math.round(((success + duplicatesCount) / total) * 100) : 0;

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-y-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
          
          {/* Header Card */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl text-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-blue-500" />
             <div className="relative z-10">
                <div className="inline-flex p-4 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mb-4 shadow-sm">
                   <Check size={40} strokeWidth={3} />
                </div>
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Processing Complete!</h2>
                <p className="text-gray-500 dark:text-gray-400">Your batch has been processed successfully.</p>
             </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             {/* Total */}
             <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
                <div className="text-gray-500 dark:text-gray-400 font-medium mb-1">Total Images</div>
                <div className="text-4xl font-bold text-gray-800 dark:text-white">{total}</div>
             </div>
             
             {/* Success */}
             <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border-l-4 border-l-green-500 border-t border-r border-b border-gray-100 dark:border-gray-700">
                <div className="text-green-600 dark:text-green-400 font-medium mb-1">Successful (New)</div>
                <div className="text-4xl font-bold text-gray-800 dark:text-white">{success}</div>
             </div>

             {/* Duplicates */}
             <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border-l-4 border-l-orange-400 border-t border-r border-b border-gray-100 dark:border-gray-700">
                <div className="text-orange-500 dark:text-orange-400 font-medium mb-1">Duplicates</div>
                <div className="text-4xl font-bold text-gray-800 dark:text-white">{duplicatesCount}</div>
             </div>

             {/* Failed */}
             <div className={`bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border-l-4 border-t border-r border-b ${failed > 0 ? 'border-l-red-500 border-gray-100 dark:border-gray-700' : 'border-l-gray-300 border-gray-100 dark:border-gray-700'}`}>
                <div className={`${failed > 0 ? 'text-red-500' : 'text-gray-400'} font-medium mb-1`}>Failed</div>
                <div className="text-4xl font-bold text-gray-800 dark:text-white">{failed}</div>
             </div>
          </div>

          {/* Efficiency Breakdown */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
             <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                <div className="w-1 h-6 bg-blue-500 rounded-full" />
                Efficiency Breakdown
             </h3>
             
             <div className="space-y-6">
                {/* 1st Attempt */}
                <div>
                   <div className="flex justify-between mb-2">
                      <span className="text-gray-600 dark:text-gray-300 font-medium">1st Attempt Success</span>
                      <span className="font-bold text-gray-800 dark:text-white">{firstAttemptSuccess}</span>
                   </div>
                   <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div className="bg-green-500 h-full rounded-full transition-all duration-1000" style={{ width: `${total > 0 ? (firstAttemptSuccess/total)*100 : 0}%` }} />
                   </div>
                </div>

                {/* Retried */}
                <div>
                   <div className="flex justify-between mb-2">
                      <span className="text-gray-600 dark:text-gray-300 font-medium">Retried Success</span>
                      <span className="font-bold text-gray-800 dark:text-white">{retrySuccess}</span>
                   </div>
                   <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div className="bg-blue-400 h-full rounded-full transition-all duration-1000" style={{ width: `${total > 0 ? (retrySuccess/total)*100 : 0}%` }} />
                   </div>
                </div>
             </div>
          </div>

           {/* Failure List */}
           {failed > 0 && (
             <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-red-100 dark:border-red-900/30 overflow-hidden">
                <div className="bg-red-50 dark:bg-red-900/20 p-4 border-b border-red-100 dark:border-red-900/30 flex items-center space-x-2">
                   <div className="bg-red-100 dark:bg-red-800 p-1.5 rounded-full">
                      <X size={16} className="text-red-600 dark:text-red-200" />
                   </div>
                   <h3 className="font-bold text-red-800 dark:text-red-200">Problematic Images</h3>
                </div>
                <div className="divide-y dark:divide-gray-700">
                   {failures.map((f, idx) => (
                      <div key={idx} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                         <div className="font-medium text-gray-700 dark:text-gray-300 break-all">{f.file}</div>
                         <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-lg">
                            {f.reason}
                         </div>
                      </div>
                   ))}
                </div>
             </div>
           )}

           <button
            onClick={resetApp}
            className="w-full bg-gradient-to-r from-gray-800 to-black text-white py-4 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 text-lg font-semibold"
          >
            Upload More Photos
          </button>
        </div>
      </div>
    );
  }

  return null;
};

// Extracted Full Screen Viewer Component with Zoom
const FullScreenViewer = ({ photo, onClose }) => {
  const [zoom, setZoom] = useState(1);
  
  const handleZoomIn = (e) => {
    e.stopPropagation();
    setZoom(prev => Math.min(prev + 0.5, 4)); // Max 4x zoom
  };

  const handleZoomOut = (e) => {
    e.stopPropagation();
    setZoom(prev => Math.max(prev - 0.5, 1)); // Min 1x zoom
  };

  const resetZoom = (e) => {
    e.stopPropagation();
    setZoom(1);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 transition-all duration-300"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-5xl h-[85vh] bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden flex flex-col animate-fade-in ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Controls Header */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-end z-50 pointer-events-none">
          <div className="flex space-x-2 pointer-events-auto">
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-700">
              <button
                className="p-2 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-all disabled:opacity-30"
                onClick={handleZoomOut}
                disabled={zoom <= 1}
              >
              <Minus size={20} />
              </button>
              <button
                className="p-2 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-all"
                onClick={resetZoom}
              >
                <RotateCcw size={20} />
              </button>
              <button
                className="p-2 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-all disabled:opacity-30"
                onClick={handleZoomIn}
                disabled={zoom >= 4}
              >
                <Plus size={20} />
              </button>
            </div>

            <button
              className="bg-red-500 hover:bg-red-600 text-white p-2.5 rounded-lg shadow-sm transition-colors"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Image Container */}
        <div 
          className="w-full h-full overflow-auto flex items-center justify-center bg-gray-50 dark:bg-black/20"
        >
          <img
            src={photo.url}
            alt="Popup View"
            className="max-w-none transition-transform duration-200 ease-out origin-center cursor-move"
            style={{ 
              transform: `scale(${zoom})`,
              // When not zoomed, fit within the modal container
              maxWidth: zoom === 1 ? '100%' : 'none', 
              maxHeight: zoom === 1 ? '100%' : 'none',
              objectFit: 'contain'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default PhotoUploadApp;