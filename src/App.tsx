import { useRef, useState, useEffect } from 'react';
import { PhotoEditor, type PhotoEditorRef } from './components/PhotoEditor';
import { exportComparison } from './utils/canvasExport';
import { Download, Columns, Rows, Trash2 } from 'lucide-react';

function App() {
  const topRef = useRef<PhotoEditorRef>(null);
  const bottomRef = useRef<PhotoEditorRef>(null);
  const [layout, setLayout] = useState<'horizontal' | 'vertical'>('horizontal');
  const [screenRatio, setScreenRatio] = useState("1 / 1");
  const [topLabel, setTopLabel] = useState("Before");
  const [bottomLabel, setBottomLabel] = useState("After");

  useEffect(() => {
    const updateRatio = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      
      if (isLandscape) {
         setScreenRatio(`3 / 2`);
      } else {
         setScreenRatio(`2 / 3`);
      }
    };
    updateRatio();
    window.addEventListener('resize', updateRatio);
    return () => window.removeEventListener('resize', updateRatio);
  }, []);

  const handleExport = () => {
    const topData = topRef.current?.getExportData();
    const bottomData = bottomRef.current?.getExportData();
    if (!topData || !bottomData) {
      alert("Please upload both photos before exporting.");
      return;
    }
    
    // We pass both data objects to our exporter.
    exportComparison(topData, bottomData, layout, topLabel, bottomLabel);
  };

  const handleResetAll = () => {
    if (confirm("Clear both photos?")) {
      topRef.current?.clearPhoto();
      bottomRef.current?.clearPhoto();
    }
  };

  const handleMultipleFiles = (files: File[]) => {
    if (files[0] && topRef.current) {
      topRef.current.setPhoto(files[0]);
    }
    if (files[1] && bottomRef.current) {
      bottomRef.current.setPhoto(files[1]);
    }
  };

  return (
    <div className="h-[100dvh] min-h-[100dvh] bg-black text-white flex flex-col font-sans overflow-hidden">
      <header className="py-4 px-6 border-b border-white/10 flex items-center justify-between bg-black/90 backdrop-blur z-50 shrink-0">
        <h1 className="text-xl font-medium tracking-tight text-zinc-100 flex items-center gap-3">
          <span className="bg-white text-black px-2 py-0.5 rounded-sm font-bold tracking-tighter">VS</span>
          <span>Compare</span>
        </h1>
        
        <div className="flex items-center gap-2 md:gap-3">
          <button
             onClick={handleResetAll}
             className="flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-400/10 p-2 transition-colors active:scale-95 bg-white/5 rounded-full"
             title="Clear Photos"
          >
             <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
          </button>

          <button
             onClick={() => setLayout(prev => prev === 'horizontal' ? 'vertical' : 'horizontal')}
             className="flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 p-2 transition-colors active:scale-95 bg-white/5 rounded-full"
             title={layout === 'horizontal' ? "Switch to Stacked" : "Switch to Side-by-Side"}
          >
             {layout === 'horizontal' ? <Rows className="w-4 h-4 md:w-5 md:h-5" /> : <Columns className="w-4 h-4 md:w-5 md:h-5" />}
          </button>

          <button
             onClick={handleExport}
             className="flex items-center gap-1.5 md:gap-2 bg-white text-black px-3 py-1.5 md:px-4 md:py-2 rounded-full font-medium shadow-lg shadow-white/5 hover:bg-zinc-200 transition-all active:scale-95 text-sm md:text-base"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export Comparison</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex">
        <div className={`w-full h-full grid items-center justify-items-center ${layout === 'horizontal' ? 'grid-cols-2 grid-rows-1' : 'grid-cols-1 grid-rows-2'}`}>
          {/* Top/Left Panel */}
          <div className="w-full h-full flex items-center justify-center min-w-0 min-h-0">
             <div className={`flex flex-col items-center ${layout === 'horizontal' ? 'w-full' : 'h-full'}`}>
                <div className={`relative shrink min-h-0 min-w-0 ${layout === 'horizontal' ? 'w-full' : 'h-full'}`} style={{ aspectRatio: screenRatio }}>
                   <PhotoEditor ref={topRef} onFilesSelected={handleMultipleFiles} />
                </div>
                <input
                   value={topLabel}
                   onChange={(e) => setTopLabel(e.target.value)}
                   spellCheck={false}
                   className="shrink-0 mt-1.5 sm:mt-2 text-zinc-400 font-bold uppercase tracking-widest text-[10px] sm:text-xs bg-transparent border-none outline-none text-center w-full"
                />
             </div>
          </div>
          
          {/* Bottom/Right Panel */}
          <div className="w-full h-full flex items-center justify-center min-w-0 min-h-0">
             <div className={`flex flex-col items-center ${layout === 'horizontal' ? 'w-full' : 'h-full'}`}>
                <div className={`relative shrink min-h-0 min-w-0 ${layout === 'horizontal' ? 'w-full' : 'h-full'}`} style={{ aspectRatio: screenRatio }}>
                   <PhotoEditor ref={bottomRef} onFilesSelected={handleMultipleFiles} />
                </div>
                <input
                   value={bottomLabel}
                   onChange={(e) => setBottomLabel(e.target.value)}
                   spellCheck={false}
                   className="shrink-0 mt-1.5 sm:mt-2 text-zinc-400 font-bold uppercase tracking-widest text-[10px] sm:text-xs bg-transparent border-none outline-none text-center w-full"
                />
             </div>
          </div>
        </div>
      </main>

    </div>
  );
}

export default App;
