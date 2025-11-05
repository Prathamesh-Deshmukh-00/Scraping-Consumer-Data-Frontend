import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, Check, ArrowRight, ArrowLeft } from 'lucide-react';

const PhotoUploadApp = () => {
  const [screen, setScreen] = useState('home'); // home, camera, preview, uploading, success
  const [photos, setPhotos] = useState([]);
  const [selectedPhotos, setSelectedPhotos] = useState(new Set());
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Start camera
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' },
        audio: false 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setScreen('camera');
    } catch (err) {
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
    setPhotos(newPhotos);
    setSelectedPhotos(new Set(newPhotos.map(p => p.id)));
    setScreen('preview');
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

  // Go to preview
  const goToPreview = () => {
    stopCamera();
    setScreen('preview');
  };

  // Upload photos
  const uploadPhotos = async () => {
    const selectedPhotosList = photos.filter(p => selectedPhotos.has(p.id));
    setUploadProgress({ current: 0, total: selectedPhotosList.length });
    setScreen('uploading');

    const batchSize = 5;
    let uploaded = 0;

    for (let i = 0; i < selectedPhotosList.length; i += batchSize) {
      const batch = selectedPhotosList.slice(i, i + batchSize);
      const formData = new FormData();
      
      batch.forEach((photo, index) => {
        formData.append('images', photo.blob, `photo_${i + index}.jpg`);
      });

      try {
        await fetch('https://scraping-consumer-data.onrender.com/api/upload-images', {
          method: 'POST',
          body: formData
        });
        
        uploaded += batch.length;
        setUploadProgress({ current: uploaded, total: selectedPhotosList.length });
        
        // Wait 1 second before next batch
        if (i + batchSize < selectedPhotosList.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        alert('Upload failed: ' + error.message);
        setScreen('preview');
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
      </div>
    );
  }

  // Camera Screen
  if (screen === 'camera') {
    return (
      <div className="fixed inset-0 bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
          <div className="flex items-center justify-between max-w-md mx-auto">
            {/* Photo Counter */}
            <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white font-medium">
              {photos.length} Photo{photos.length !== 1 ? 's' : ''}
            </div>

            {/* Capture Button */}
            <button
              onClick={capturePhoto}
              className="w-20 h-20 rounded-full bg-white border-4 border-gray-300 shadow-lg active:scale-95 transition-transform"
            />

            {/* Next Button */}
            <button
              onClick={goToPreview}
              disabled={photos.length === 0}
              className="bg-blue-500 disabled:bg-gray-500 disabled:opacity-50 text-white p-4 rounded-full shadow-lg active:scale-95 transition-all"
            >
              <ArrowRight size={24} />
            </button>
          </div>
        </div>

        {/* Back Button */}
        <button
          onClick={() => {
            stopCamera();
            resetApp();
          }}
          className="absolute top-6 left-6 bg-black/50 backdrop-blur-sm text-white p-3 rounded-full"
        >
          <ArrowLeft size={24} />
        </button>
      </div>
    );
  }

  // Preview Screen
  if (screen === 'preview') {
    const selectedCount = selectedPhotos.size;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={resetApp}
              className="text-gray-600 hover:text-gray-800 flex items-center space-x-2"
            >
              <ArrowLeft size={20} />
              <span>Back</span>
            </button>
            <div className="text-lg font-semibold text-gray-700">
              Selected {selectedCount} / {photos.length} Photo{photos.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Photo Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6">
            {photos.map(photo => {
              const isSelected = selectedPhotos.has(photo.id);
              return (
                <div
                  key={photo.id}
                  onClick={() => togglePhotoSelection(photo.id)}
                  className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer transition-all duration-200 ${
                    isSelected ? 'ring-4 ring-blue-500 scale-100' : 'opacity-50 scale-95'
                  }`}
                >
                  <img
                    src={photo.url}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                      <Check size={20} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Upload Button */}
          <button
            onClick={uploadPhotos}
            disabled={selectedCount === 0}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 disabled:from-gray-400 disabled:to-gray-500 text-white py-4 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 text-lg font-semibold disabled:cursor-not-allowed"
          >
            Upload {selectedCount} Photo{selectedCount !== 1 ? 's' : ''}
          </button>
        </div>
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
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Uploading...</h2>
            <p className="text-gray-600">
              {uploadProgress.current} / {uploadProgress.total} photos uploaded
            </p>
          </div>

          {/* Progress Bar */}
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