import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, X } from 'lucide-react';

// Watermark configuration constants
const WATERMARK_TEXT = 'Doubao AI';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const TARGET_WIDTH = 1024; // Target width for image scaling

export default () => {
  // State management
  const [originalImage, setOriginalImage] = useState(null);
  const [processedImageUrl, setProcessedImageUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [customColor, setCustomColor] = useState('#000000');
  const [opacity, setOpacity] = useState(1); // Default to fully opaque
  const [originalImgData, setOriginalImgData] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // DOM references
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);
  const previewContainerRef = useRef(null);

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

  // Get opposite color
  const getOppositeColor = (r, g, b) => {
    // Calculate luminance to determine light or dark
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // If background is bright, use dark text; if dark, use light text
    if (luminance > 0.5) {
      // Bright background - use black
      return { r: 0, g: 0, b: 0 };
    } else {
      // Dark background - use white
      return { r: 255, g: 255, b: 255 };
    }
  };

  // Analyze image corner color
  const analyzeCornerColor = useCallback((img) => {
    if (!img) return { r: 0, g: 0, b: 0 };

    // Create a temporary canvas to analyze the image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return { r: 0, g: 0, b: 0 };

    // We only need a small portion of the image to analyze
    const sampleSize = 20;
    canvas.width = sampleSize;
    canvas.height = sampleSize;

    // Draw the bottom right corner of the image to our small canvas
    ctx.drawImage(
      img,
      img.width - sampleSize, img.height - sampleSize, sampleSize, sampleSize,
      0, 0, sampleSize, sampleSize
    );

    // Get pixel data from the sampled area
    const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
    const data = imageData.data;

    // Calculate average color of the sampled area
    let totalR = 0, totalG = 0, totalB = 0;
    const pixelCount = sampleSize * sampleSize;

    for (let i = 0; i < data.length; i += 4) {
      totalR += data[i];
      totalG += data[i + 1];
      totalB += data[i + 2];
      // Skip alpha channel (data[i + 3])
    }

    const avgR = Math.floor(totalR / pixelCount);
    const avgG = Math.floor(totalG / pixelCount);
    const avgB = Math.floor(totalB / pixelCount);

    return { r: avgR, g: avgG, b: avgB };
  }, []);

  // Process image and add watermark
  const processImage = useCallback((img, fileType) => {
    if (!img) return null;

    // Calculate scaled dimensions
    const { width: scaledWidth, height: scaledHeight } = calculateScaledDimensions(
      img.width,
      img.height
    );

    // Create Canvas element with scaled dimensions
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Set Canvas dimensions to scaled size
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;

    // Draw and scale original image to canvas
    ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

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
    const watermarkColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;

    // Set watermark style
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = watermarkColor;
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
    return canvas.toDataURL(fileType || 'image/png');
  }, [calculateScaledDimensions, customColor, opacity]);

  // Load original image data
  const loadOriginalImage = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          resolve(img);
        };
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
        img.src = e.target?.result;
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !validateFile(file)) return;

    setIsProcessing(true);
    setOriginalImage(file);
    setErrorMessage(null);
    setShowSettings(false); // Hide settings when uploading new image

    try {
      const img = await loadOriginalImage(file);
      setOriginalImgData(img);

      // Analyze corner color and set opposite color as default
      const cornerColor = analyzeCornerColor(img);
      const oppositeColor = getOppositeColor(cornerColor.r, cornerColor.g, cornerColor.b);

      // Convert RGB to hex
      const oppositeHex = `#${((1 << 24) + (oppositeColor.r << 16) + (oppositeColor.g << 8) + oppositeColor.b).toString(16).slice(1)}`;
      setCustomColor(oppositeHex);
      setOpacity(1); // Set to fully opaque

      // Initial processing with current settings
      const dataUrl = processImage(img, file.type);
      if (dataUrl) {
        setProcessedImageUrl(dataUrl);
      }
    } catch (err) {
      setErrorMessage('Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [validateFile, loadOriginalImage, processImage, analyzeCornerColor]);

  // Handle drag and drop upload
  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (!file || !validateFile(file)) return;

    setIsProcessing(true);
    setOriginalImage(file);
    setErrorMessage(null);
    setShowSettings(false); // Hide settings when uploading new image

    try {
      const img = await loadOriginalImage(file);
      setOriginalImgData(img);

      // Analyze corner color and set opposite color as default
      const cornerColor = analyzeCornerColor(img);
      const oppositeColor = getOppositeColor(cornerColor.r, cornerColor.g, cornerColor.b);

      // Convert RGB to hex
      const oppositeHex = `#${((1 << 24) + (oppositeColor.r << 16) + (oppositeColor.g << 8) + oppositeColor.b).toString(16).slice(1)}`;
      setCustomColor(oppositeHex);
      setOpacity(1); // Set to fully opaque

      // Initial processing with current settings
      const dataUrl = processImage(img, file.type);
      if (dataUrl) {
        setProcessedImageUrl(dataUrl);
      }
    } catch (err) {
      setErrorMessage('Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);

      // Remove drag highlight state
      if (dropZoneRef.current) {
        dropZoneRef.current.classList.remove('drop-zone--active');
      }
    }
  }, [validateFile, loadOriginalImage, processImage, analyzeCornerColor]);

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
    setOriginalImgData(null);
    setCustomColor('#000000');
    setOpacity(1); // Reset to fully opaque
    setShowSettings(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Handle click on preview image
  const handlePreviewClick = useCallback((e) => {
    if (!originalImgData) return;

    // Get the actual size of the preview image
    const previewImg = e.target;
    const previewRect = previewImg.getBoundingClientRect();

    // Calculate scale factor between actual image and preview
    const scaleX = originalImgData.width / previewImg.width;
    const scaleY = originalImgData.height / previewImg.height;

    // Calculate click position relative to actual image
    const clickX = (e.clientX - previewRect.left) * scaleX;
    const clickY = (e.clientY - previewRect.top) * scaleY;

    // Calculate watermark position on actual image
    const margin = 20;
    const textWidth = 24 * WATERMARK_TEXT.length * 0.6; // Approximate text width
    const textHeight = 24;

    const watermarkX1 = originalImgData.width - margin - textWidth;
    const watermarkX2 = originalImgData.width - margin;
    const watermarkY1 = originalImgData.height - margin - textHeight;
    const watermarkY2 = originalImgData.height - margin;

    // Check if click was within watermark area
    if (clickX >= watermarkX1 && clickX <= watermarkX2 && clickY >= watermarkY1 && clickY <= watermarkY2) {
      setShowSettings(true);
    }
  }, [originalImgData]);

  // Effect for real-time preview
  useEffect(() => {
    if (!originalImgData || !originalImage) return;

    // Process image with current settings
    const dataUrl = processImage(originalImgData, originalImage.type);
    if (dataUrl) {
      setProcessedImageUrl(dataUrl);
    }
  }, [originalImgData, originalImage, customColor, opacity, processImage]);

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
                {!showSettings && (
                  <p className="text-xs text-gray-400 mt-2">Tip: Watermark color will automatically adapt to image corner color</p>
                )}
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
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Live Preview</h2>
            <div
              ref={previewContainerRef}
              className="relative rounded-lg overflow-hidden border border-gray-200 mb-4 cursor-pointer preview"
              onClick={handlePreviewClick}
            >
              <img
                src={processedImageUrl}
                alt="Image with watermark"
                className="w-full h-auto"
              />
              {/* Optional: Add a visual indicator for clickable watermark area */}
              {showSettings && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border-2 border-blue-500 setting">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-700">Watermark Settings</h3>
                    <button
                      onClick={() => setShowSettings(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

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
                </div>
              )}
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