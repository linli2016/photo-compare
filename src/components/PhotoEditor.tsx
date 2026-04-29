import { useRef, useState, useImperativeHandle, forwardRef, useEffect } from 'react';
import { usePinch, useDrag } from '@use-gesture/react';
import { Upload, RotateCw, Trash2, ZoomIn, ZoomOut, Grid3X3, RotateCcw, X, Lock, Unlock } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export type SyncAction =
  | { type: 'SET_GRID'; value: boolean }
  | { type: 'SET_ROTATION_LOCK'; value: boolean }
  | { type: 'HIDE_CONTROLS' };

export interface PhotoEditorRef {
  getExportData: () => {
    image: HTMLImageElement;
    x: number;
    y: number;
    scale: number;
    rotation: number;
    containerWidth: number;
    containerHeight: number;
    showGrid: boolean;
  } | null;
  clearPhoto: () => void;
  setPhoto: (file: File) => void;
  applySyncAction: (action: SyncAction) => void;
}

export interface PhotoEditorProps {
  onFilesSelected?: (files: File[]) => void;
  onSyncAction?: (action: SyncAction) => void;
}

export const PhotoEditor = forwardRef<PhotoEditorRef, PhotoEditorProps>(({ onFilesSelected, onSyncAction }, ref) => {
  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Transform states
  const transformConfig = useRef({ x: 0, y: 0, scale: 1, rotation: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [isGesturing, setIsGesturing] = useState(false);
  const [rotationEnabled, setRotationEnabled] = useState(false);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setObjectUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  const updateTransformStyle = () => {
    if (imageRef.current) {
      const { x, y, scale, rotation } = transformConfig.current;
      imageRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scale}) rotate(${rotation}deg)`;
    }
  };

  const setScale = (newScale: number) => {
    transformConfig.current.scale = newScale;
    setZoomLevel(newScale);
    updateTransformStyle();
  };

  useImperativeHandle(ref, () => ({
    getExportData: () => {
      if (!imageRef.current || !containerRef.current) return null;
      return {
        image: imageRef.current,
        x: transformConfig.current.x,
        y: transformConfig.current.y,
        scale: transformConfig.current.scale,
        rotation: transformConfig.current.rotation,
        containerWidth: containerRef.current.clientWidth,
        containerHeight: containerRef.current.clientHeight,
        showGrid: showGrid,
      };
    },
    clearPhoto: () => {
      setFile(null);
      setObjectUrl(null);
      transformConfig.current = { x: 0, y: 0, scale: 1, rotation: 0 };
    },
    setPhoto: (newFile: File) => {
      setFile(newFile);
      transformConfig.current = { x: 0, y: 0, scale: 1, rotation: 0 };
      setZoomLevel(1);
      setRotationDeg(0);
    },
    applySyncAction: (action: SyncAction) => {
      switch (action.type) {
        case 'SET_GRID': setShowGrid(action.value); break;
        case 'SET_ROTATION_LOCK': setRotationEnabled(action.value); break;
        case 'HIDE_CONTROLS': setShowControls(false); break;
      }
    }
  }));

  const setRotation = (rawDeg: number) => {
    let deg = rawDeg % 360;
    if (deg > 180) deg -= 360;
    if (deg < -180) deg += 360;
    
    transformConfig.current.rotation = deg;
    setRotationDeg(deg);
    updateTransformStyle();
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (onFilesSelected && e.target.files.length > 1) {
        onFilesSelected(Array.from(e.target.files));
      } else {
        setFile(e.target.files[0]);
        transformConfig.current = { x: 0, y: 0, scale: 1, rotation: 0 };
        setZoomLevel(1);
        setRotationDeg(0);
      }
    }
  };

  const resetTransform = () => {
    transformConfig.current = { x: 0, y: 0, scale: 1, rotation: 0 };
    setZoomLevel(1);
    setRotationDeg(0);
    updateTransformStyle();
  };

  const handleGridToggle = (show: boolean, isSync = false) => {
    setShowGrid(show);
    if (!isSync && onSyncAction) onSyncAction({ type: 'SET_GRID', value: show });
  };

  const handleRotationLockToggle = (enabled: boolean, isSync = false) => {
    setRotationEnabled(enabled);
    if (!isSync && onSyncAction) onSyncAction({ type: 'SET_ROTATION_LOCK', value: enabled });
  };

  const handleRotate = () => {
    let newRot = transformConfig.current.rotation + 90;
    if (newRot > 180) newRot -= 360;
    setRotation(newRot);
  };

  // Gestures mapping
  usePinch(({ offset: [d, a], memo, event, active }) => {
    // Prevent default pinch zoom on safari
    if (event) event.preventDefault();
    setScale(d);
    if (rotationEnabled) {
      setRotation(a);
    }
    setIsGesturing(active);
    return memo;
  }, {
    target: containerRef,
    eventOptions: { passive: false },
    scaleBounds: { min: 0.1, max: 10 },
    from: () => [transformConfig.current.scale, transformConfig.current.rotation]
  });

  useDrag(({ tap, offset: [ox, oy], active }) => {
    if (tap) {
      setShowControls(prev => {
        const next = !prev;
        if (next && onSyncAction) {
          onSyncAction({ type: 'HIDE_CONTROLS' });
        }
        return next;
      });
      return;
    }

    transformConfig.current.x = ox;
    transformConfig.current.y = oy;
    updateTransformStyle();
    setIsGesturing(active);
  }, {
    target: containerRef,
    from: () => [transformConfig.current.x, transformConfig.current.y],
    filterTaps: true,
  });

  // Handle desktop mouse wheel for zooming
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let wheelTimeout: ReturnType<typeof setTimeout>;

    const preventPinchZoom = (e: WheelEvent) => {
      e.preventDefault();
      setIsGesturing(true);
      const zoomSensitivity = 0.005;
      let newScale = transformConfig.current.scale - (e.deltaY * zoomSensitivity);
      newScale = Math.max(0.1, Math.min(newScale, 10)); // Clamp scale
      setScale(newScale);
      
      clearTimeout(wheelTimeout);
      wheelTimeout = setTimeout(() => setIsGesturing(false), 300);
    };

    el.addEventListener('wheel', preventPinchZoom, { passive: false });
    return () => {
      el.removeEventListener('wheel', preventPinchZoom);
      clearTimeout(wheelTimeout);
    };
  }, []);


  if (!objectUrl) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full min-h-0 bg-zinc-900 border border-white/5 transition-colors hover:bg-zinc-800/80 p-6">
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          ref={fileInputRef}
          onChange={handleUpload}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center gap-3 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <div className="p-4 bg-zinc-800 rounded-full shadow-inner shadow-black outline outline-1 outline-white/5">
            <Upload className="w-8 h-8" />
          </div>
          <span className="font-medium text-sm">Upload Photo</span>
          <span className="text-xs text-zinc-500 max-w-xs text-center mt-1">
            Tap here to browse photos or shoot from your camera
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col group min-h-0">
      {/* Container holding the bounded image */}
      <div
        ref={containerRef}
        className="relative flex-1 bg-black overflow-hidden cursor-grab active:cursor-grabbing touch-none ring-1 ring-white/5"
      >
        <img
          ref={imageRef}
          src={objectUrl}
          draggable={false}
          className="absolute inset-0 max-w-none origin-center w-full h-full object-contain pointer-events-none"
          alt="Upload preview"
        />
        
        {/* Grid Overlay */}
        {(showGrid || isGesturing) && (
          <div 
            className="absolute inset-0 pointer-events-none z-50"
            style={{
              backgroundImage: `
                repeating-linear-gradient(to right, rgba(255,255,255,0.2) 0px, rgba(255,255,255,0.2) 1px, transparent 1px, transparent 10%),
                repeating-linear-gradient(to bottom, rgba(255,255,255,0.2) 0px, rgba(255,255,255,0.2) 1px, transparent 1px, transparent 10%)
              `
            }}
          >
            {/* Center crosshair for easier alignment */}
            <div className="absolute inset-x-0 top-1/2 h-[1px] bg-white/60 -translate-y-1/2" />
            <div className="absolute inset-y-0 left-1/2 w-[1px] bg-white/60 -translate-x-1/2" />
          </div>
        )}
      </div>

      {/* Overlay controls - slide up on hover or toggle */}
      <div className={cn(
        "absolute bottom-4 inset-x-0 mx-auto w-[90%] md:w-3/4 max-w-sm rounded-xl py-3 px-4 bg-zinc-900/90 backdrop-blur border border-white/5 shadow-2xl flex flex-col gap-3 transition-all duration-300 z-40",
        showControls 
          ? "opacity-100 pointer-events-auto translate-y-0" 
          : "opacity-0 translate-y-4 pointer-events-none md:translate-y-0 md:pointer-events-auto md:opacity-0 md:group-hover:opacity-100"
      )}>
        
        {/* Zoom Slider */}
        <div className="flex items-center gap-3 w-full">
          <ZoomOut className="w-4 h-4 text-zinc-400" />
          <input
            type="range"
            min="0.1"
            max="10"
            step="0.1"
            value={zoomLevel}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            onPointerDown={() => setIsGesturing(true)}
            onPointerUp={() => setIsGesturing(false)}
            onPointerCancel={() => setIsGesturing(false)}
            className="flex-1 accent-white h-1 bg-zinc-700/50 rounded-full appearance-none outline-none"
          />
          <ZoomIn className="w-4 h-4 text-zinc-400" />
        </div>

        {/* Rotation Slider */}
        {rotationEnabled && (
          <div className="flex items-center gap-3 w-full">
            <button onClick={() => setRotation(0)} title="Reset rotation" className="text-zinc-400 hover:text-white transition-colors">
              <RotateCcw className="w-4 h-4" />
            </button>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={rotationDeg}
              onChange={(e) => setRotation(parseFloat(e.target.value))}
              onPointerDown={() => setIsGesturing(true)}
              onPointerUp={() => setIsGesturing(false)}
              onPointerCancel={() => setIsGesturing(false)}
              className="flex-1 accent-white h-1 bg-zinc-700/50 rounded-full appearance-none outline-none"
            />
            <button onClick={handleRotate} title="Rotate 90 degrees" className="text-zinc-400 hover:text-white transition-colors">
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1 pt-3 border-t border-white/5">
          <button
            onClick={handleRotate}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white transition-colors text-sm font-medium shrink-0"
          >
            <RotateCw className="w-4 h-4" />
            <span className="hidden sm:inline">Rotate</span>
          </button>
          <button
            onClick={() => handleRotationLockToggle(!rotationEnabled)}
            className={cn(
              "flex items-center justify-center p-1.5 rounded-lg transition-colors shrink-0",
              rotationEnabled ? "bg-white/20 text-white" : "hover:bg-white/10 text-zinc-300 hover:text-white"
            )}
            title={rotationEnabled ? "Lock Rotation" : "Unlock Free Rotation"}
          >
            {rotationEnabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </button>
          <button
            onClick={() => handleGridToggle(!showGrid)}
            className={cn(
              "flex items-center justify-center p-1.5 rounded-lg transition-colors shrink-0",
              showGrid ? "bg-white/20 text-white" : "hover:bg-white/10 text-zinc-300 hover:text-white"
            )}
            title="Toggle Grid"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-4 bg-white/10 mx-0.5 shrink-0" />
          <button
            onClick={() => resetTransform()}
            className="px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white transition-colors text-sm font-medium shrink-0"
          >
            Reset
          </button>
          <button
            onClick={() => {
              setFile(null);
              setObjectUrl(null);
            }}
            className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors shrink-0"
            title="Clear photo"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowControls(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white transition-colors md:hidden shrink-0"
            title="Hide controls"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
});
