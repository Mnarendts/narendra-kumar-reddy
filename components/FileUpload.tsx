import React, { ChangeEvent, useId, useState, useRef, useEffect } from 'react';
import { Upload, X, FileImage, Camera, RefreshCw } from 'lucide-react';

interface FileUploadProps {
  label: string;
  subLabel?: string;
  filePreview: string | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  accept?: string;
  icon?: React.ReactNode;
  capture?: 'user' | 'environment';
}

const FileUpload: React.FC<FileUploadProps> = ({
  label,
  subLabel,
  filePreview,
  onFileSelect,
  onClear,
  accept = "image/*",
  icon,
  capture
}) => {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API not supported");
      }
      
      setIsCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      
      // Slight delay to ensure video element is mounted
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      let msg = "Could not access camera.";
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = "Camera permission denied. Please allow camera access.";
      } else if (err.name === 'NotFoundError') {
        msg = "No camera found on this device.";
      }
      setCameraError(msg);
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
            onFileSelect(file);
            stopCamera();
          }
        }, 'image/jpeg', 0.85);
      }
    }
  };

  const handleStopCameraClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    stopCamera();
  };

  return (
    <div className="flex flex-col w-full h-full">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      
      {!filePreview ? (
        <div className="relative group flex-1 h-full min-h-[16rem]">
          {isCameraOpen ? (
            // Camera View
            <div className="absolute inset-0 bg-black rounded-xl overflow-hidden flex flex-col items-center justify-center">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              <div className="absolute bottom-4 flex gap-4 z-10">
                <button
                  type="button"
                  onClick={handleStopCameraClick}
                  className="bg-white/20 backdrop-blur-sm text-white p-3 rounded-full hover:bg-white/30 transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="bg-white text-slate-900 p-4 rounded-full shadow-lg hover:scale-105 transition-transform border-4 border-slate-200/50"
                >
                  <div className="w-6 h-6 rounded-full bg-red-500 border-2 border-white" />
                </button>
              </div>
            </div>
          ) : (
            // Upload Dropzone View
            <div 
              onClick={triggerFileInput}
              className="flex flex-col items-center justify-center w-full h-full border-2 border-dashed border-slate-300 rounded-xl cursor-pointer bg-white hover:bg-slate-50 hover:border-blue-400 transition-all duration-300 relative"
            >
              <input 
                ref={fileInputRef}
                id={inputId}
                type="file" 
                className="hidden" 
                accept={accept} 
                capture={capture}
                onChange={handleInputChange} 
              />
              
              <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center z-10">
                {icon || <Upload className="w-8 h-8 mb-3 text-slate-400 group-hover:text-blue-500 transition-colors" />}
                <p className="mb-1 text-sm text-slate-500 font-medium">Click to Upload</p>
                {subLabel && <p className="text-xs text-slate-400 mb-4">{subLabel}</p>}
                
                <div className="flex items-center gap-3 w-full max-w-[200px] mb-4">
                  <div className="h-px bg-slate-200 flex-1"></div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">OR</span>
                  <div className="h-px bg-slate-200 flex-1"></div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    startCamera();
                  }}
                  className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors border border-blue-100"
                >
                  <Camera className="w-4 h-4" /> Use Camera
                </button>
                
                {cameraError && (
                  <p className="mt-3 text-xs text-red-500 font-medium bg-red-50 px-2 py-1 rounded">
                    {cameraError}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        // Preview View
        <div className="relative w-full h-full min-h-[16rem] rounded-xl overflow-hidden border border-slate-200 shadow-sm group bg-slate-50">
          <img 
            src={filePreview} 
            alt="Preview" 
            className="w-full h-full object-contain" 
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
             <button
              onClick={onClear}
              type="button"
              className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-transform hover:scale-105 shadow-lg"
              title="Remove"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded text-xs font-semibold text-slate-700 shadow-sm flex items-center gap-1 backdrop-blur-md">
             <FileImage className="w-3 h-3" /> Image Loaded
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;