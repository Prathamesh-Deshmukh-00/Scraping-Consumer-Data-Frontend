import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, X, Check, ArrowRight, ArrowLeft, Loader } from 'lucide-react';

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
    const files = Array.from(e.target.files);
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
    // setShowPreviewPopup(true); // ❌ Disable popup for inline preview
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

  // Upload photos SEQUENTIALLY to show accurate progress
  const uploadPhotos = async () => {
    const selectedPhotosList = photos.filter(p => selectedPhotos.has(p.id));
    setUploadProgress({ current: 0, total: selectedPhotosList.length });
    setShowPreviewPopup(false);
    setScreen('uploading');

    let uploaded = 0;

    for (let i = 0; i < selectedPhotosList.length; i++) {
      const photo = selectedPhotosList[i];

      // Update Progress UI - Force re-render with specific text if needed (we can use the component state below)
      // Since screen is 'uploading', we can add a specific status message state if needed, 
      // but for now we rely on the progress counts.

      const formData = new FormData();
      formData.append('images', photo.blob, `photo_${i}.jpg`);

      try {
        const backendURL = import.meta.env.VITE_BACKEND_URL || "";
        await fetch(`${backendURL}/api/upload-images`, {
          method: 'POST',
          body: formData
        });

        uploaded++;
        setUploadProgress({ current: uploaded, total: selectedPhotosList.length });

        // Small delay to let user see the progress
        // await new Promise(resolve => setTimeout(resolve, 500)); 

      } catch (error) {
        alert('Upload failed: ' + error.message);
        setScreen('camera'); // Go back
        return;
      }
    }

    setScreen('success');
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
    setScreen('home');
  };

  // Home Screen
  if (screen === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6 animate-fade-in">
          <h1 className="text-4xl font-bold text-center text-gray-800 mb-12">
            Photo Uploader
          </h1>

          <button
            onClick={startCamera}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-6 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-3"
          >
            <Camera size={28} />
            <span className="text-xl font-semibold">Click Photo</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white py-6 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-3"
          >
            <Upload size={28} />
            <span className="text-xl font-semibold">Upload Existing Photos</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* 🔹 Inline Preview & Upload Section */}
        {photos.length > 0 && (
          <div className="w-full mt-8 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-700">Selected Photos ({selectedPhotos.size})</h3>
              <button
                onClick={() => {
                  setPhotos([]);
                  setSelectedPhotos(new Set());
                }}
                className="text-red-500 text-sm font-medium hover:text-red-700"
              >
                Clear All
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-6">
              {photos.map(photo => (
                <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden shadow-sm border border-gray-100">
                  <img
                    src={photo.url}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => {
                      setPhotos(prev => prev.filter(p => p.id !== photo.id));
                      setSelectedPhotos(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(photo.id);
                        return newSet;
                      });
                    }}
                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-red-500 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={uploadPhotos}
              disabled={selectedPhotos.size === 0}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg text-lg transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Upload size={24} />
              Upload {selectedPhotos.size} Photos Now
            </button>
          </div>
        )}

      </div>
    );
  }

  // Camera Screen
  if (screen === 'camera') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
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
            <h2 className="text-xl font-bold text-gray-800">Camera</h2>
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
                {/* Photo Counter and Thumbnails - Clickable */}
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

                {/* Spacer for symmetry */}
                <div className="w-20"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Popup */}
        {showPreviewPopup && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Popup Header */}
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

              {/* Photo Grid */}
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

              {/* Popup Footer */}
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

        {/* Full Screen Photo View */}
        {fullScreenPhoto && (
          <div
            className="fixed inset-0 bg-black z-[60] flex items-center justify-center"
            onClick={() => setFullScreenPhoto(null)}
          >
            <button
              className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2"
              onClick={() => setFullScreenPhoto(null)}
            >
              <X size={24} />
            </button>
            <img
              src={fullScreenPhoto.url}
              alt="Full screen"
              className="max-w-full max-h-full object-contain"
            />
          </div>
        )}
      </div>
    );
  }

  // Uploading Screen
  if (screen === 'uploading') {
    const percentage = uploadProgress.total > 0
      ? Math.round((uploadProgress.current / uploadProgress.total) * 100)
      : 0;

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-6">
          <div className="text-center">
            <div className="inline-block p-4 bg-blue-100 rounded-full mb-4">
              <Upload size={48} className="text-blue-600 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Extracting number form image...</h2>
            <p className="text-gray-600">
              Processing {uploadProgress.current + 1 > uploadProgress.total ? uploadProgress.total : uploadProgress.current + 1} of {uploadProgress.total} images
            </p>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <p className="text-center text-2xl font-bold text-blue-600">{percentage}%</p>
        </div>
      </div>
    );
  }

  // Success Screen
  if (screen === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-6 text-center">
          <div className="inline-block p-4 bg-green-100 rounded-full mb-4">
            <Check size={64} className="text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800">Success!</h2>
          <p className="text-gray-600 text-lg">
            All photos uploaded successfully!
          </p>
          <button
            onClick={resetApp}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 text-lg font-semibold"
          >
            Upload More Photos
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default PhotoUploadApp;