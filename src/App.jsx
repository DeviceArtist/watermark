import React, { useState, useRef, useCallback } from 'react';
import { Upload, Download, X } from 'lucide-react';

// Watermark configuration constants
const WATERMARK_TEXT = 'Doubao AI';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const TARGET_WIDTH = 1024; // Target width for image scaling
const DEFAULT_WATERMARK_COLOR = 'rgba(0, 0, 0, 0.5)'; // Default semi-transparent black

export default () => {
  // State management
  const [originalImage, setOriginalImage] = useState(null);
  const [processedImageUrl, setProcessedImageUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [watermarkColor, setWatermarkColor] = useState(DEFAULT_WATERMARK_COLOR);
  const [customColor, setCustomColor] = useState('#000000');
  const [opacity, setOpacity] = useState(0.5);
  
  // DOM references
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  // Validate file type and size
  const validateFile = useCallback((file) => {
    // Check file type
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file');
      return false;
    }

    // Check file size
    if (file.size > MAX_IMAGE_SIZE) {
      setErrorMessage(`File size cannot exceed ${MAX_IMAGE_SIZE / (1024 * 1024)}MB`);
      return false;
    }

    setErrorMessage(null);
    return true;
  }, []);

  // Calculate new dimensions while maintaining aspect ratio
  const calculateScaledDimensions = useCallback((originalWidth, originalHeight) => {
    // Only scale if image is wider than target width
    if (originalWidth <= TARGET_WIDTH) {
      return { width: originalWidth, height: originalHeight };
    }
    
    // Calculate aspect ratio
    const aspectRatio = originalHeight / originalWidth;
    const newWidth = TARGET_WIDTH;
    const newHeight = Math.round(newWidth * aspectRatio);
    
    return { width: newWidth, height: newHeight };
  }, []);

  // Update watermark color based on custom color and opacity
  const updateWatermarkColor = useCallback(() => {
    // Convert hex to rgba
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result 
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
          }
        : { r: 0, g: 0, b: 0 };
    };
    
    const rgb = hexToRgb(customColor);
    setWatermarkColor(`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`);
  }, [customColor, opacity]);

  // Process image and add watermark
  const processImage = useCallback((file) => {
    if (!validateFile(file)) return;

    setIsProcessing(true);
    setOriginalImage(file);
    
    // Update watermark color before processing
    updateWatermarkColor();

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calculate scaled dimensions
        const { width: scaledWidth, height: scaledHeight } = calculateScaledDimensions(
          img.width, 
          img.height
        );

        // Create Canvas element with scaled dimensions
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set Canvas dimensions to scaled size
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;

        // Draw and scale original image to canvas
        ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

        // Set watermark style
        ctx.font = 'bold 24px sans-serif';
        ctx.fillStyle = watermarkColor; // Use selected watermark color
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';

        // Calculate watermark position (bottom right corner with margin)
        const margin = 20;

        // Draw watermark text
        ctx.fillText(
          WATERMARK_TEXT,
          canvas.width - margin,
          canvas.height - margin
        );

        // Generate processed image URL
        const dataUrl = canvas.toDataURL(file.type);
        setProcessedImageUrl(dataUrl);
        setIsProcessing(false);
      };

      // Handle image loading errors
      img.onerror = () => {
        setErrorMessage('Failed to load image. Please try another image.');
        setIsProcessing(false);
      };

      img.src = e.target?.result;
    };

    reader.readAsDataURL(file);
  }, [validateFile, calculateScaledDimensions, watermarkColor, updateWatermarkColor]);

  // Re-process image with new color settings
  const reprocessImage = useCallback(() => {
    if (!originalImage) return;
    
    updateWatermarkColor();
    processImage(originalImage);
  }, [originalImage, processImage, updateWatermarkColor]);

  // Handle file selection
  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  }, [processImage]);

  // Handle drag and drop upload
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (file) processImage(file);

    // Remove drag highlight state
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove('drop-zone--active');
    }
  }, [processImage]);

  // Handle drag over
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    // Add drag highlight state
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.add('drop-zone--active');
    }
  }, []);

  // Handle drag leave
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    // Remove drag highlight state
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove('drop-zone--active');
    }
  }, []);

  // Trigger file selection dialog
  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Download processed image
  const handleDownload = useCallback(() => {
    if (!processedImageUrl || !originalImage) return;

    const link = document.createElement('a');
    link.href = processedImageUrl;

    // Generate download file name
    const originalName = originalImage.name.split('.')[0];
    const extension = originalImage.name.split('.').pop();
    link.download = `${originalName}_watermarked.${extension}`;

    link.click();
  }, [processedImageUrl, originalImage]);

  // Reset state
  const resetState = useCallback(() => {
    setOriginalImage(null);
    setProcessedImageUrl(null);
    setErrorMessage(null);
    setWatermarkColor(DEFAULT_WATERMARK_COLOR);
    setCustomColor('#000000');
    setOpacity(0.5);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl p-6 shadow-lg bg-white rounded-lg">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">Image Watermark Tool</h1>
        {/* Error message */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700">{errorMessage}</p>
          </div>
        )}

        {/* Settings area */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Watermark Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="w-12 h-12 border-0 rounded-full cursor-pointer"
                />
                <input
                  type="text"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="#000000"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Opacity: {Math.round(opacity * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
          
          {processedImageUrl && (
            <button
              onClick={reprocessImage}
              className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white p-2 rounded-md"
            >
              Apply New Settings
            </button>
          )}
        </div>

        {/* Upload area */}
        {!originalImage && (
          <div
            ref={dropZoneRef}
            className={`drop-zone border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer transition-all ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            onClick={!isProcessing ? triggerFileInput : undefined}
            onDrop={!isProcessing ? handleDrop : undefined}
            onDragOver={!isProcessing ? handleDragOver : undefined}
            onDragLeave={!isProcessing ? handleDragLeave : undefined}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600">Processing image...</p>
              </div>
            ) : (
              <div className='card'>
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">Drag and drop an image here, or click to select a file</p>
                <p className="text-sm text-gray-500">Supports JPG, PNG, etc. Maximum 10MB. Images will be automatically scaled to 1024px width.</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
              disabled={isProcessing}
            />
          </div>
        )}

        {/* Preview area */}
        {processedImageUrl && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Processing Result Preview</h2>
            <div className="relative rounded-lg overflow-hidden border border-gray-200 mb-4">
              <img
                src={processedImageUrl}
                alt="Image with watermark"
                className="w-full h-auto"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDownload}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-md flex items-center justify-center"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Image
              </button>

              <button
                onClick={resetState}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 p-3 rounded-md flex items-center justify-center"
              >
                <X className="mr-2 h-4 w-4" />
                Upload New Image
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};