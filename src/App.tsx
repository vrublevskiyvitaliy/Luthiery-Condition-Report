/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { 
  FileDown, 
  Trash2, 
  Undo2, 
  Plus, 
  Minus, 
  Type, 
  ArrowRight, 
  Square, 
  PenTool,
  Info,
  Layers,
  Settings2,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Annotation, ViolinState } from './types';
import { COLORS, HATCH_PATTERNS, VIEWS, TOOL_TYPES, WIDTH_OPTIONS } from './constants';
import LuthierCanvas from './components/LuthierCanvas';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export default function App() {
  const [state, setState] = useState<ViolinState>({
    annotations: [],
    nextNumber: 1,
    instrumentName: 'Messiah Stradivarius',
  });
  const [currentView, setCurrentView] = useState<'front' | 'back'>('front');
  const [currentTool, setCurrentTool] = useState<string>('crack');
  const [currentColor, setCurrentColor] = useState<string>(COLORS[0].value);
  const [currentWidth, setCurrentWidth] = useState<number>(3);
  const [currentHatch, setCurrentHatch] = useState<string>('none');
  const [zoom, setZoom] = useState<number>(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [textModal, setTextModal] = useState<{ x: number, y: number, open: boolean, id?: string }>({ x: 0, y: 0, open: false });
  const [pendingText, setPendingText] = useState('');
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);

  const [containerSize, setContainerSize] = useState({ width: 800, height: 1000 });

  const handleTextSubmit = () => {
    if (pendingText.trim()) {
      if (textModal.id) {
        updateAnnotation(textModal.id, { text: pendingText.trim() });
      } else {
        addAnnotation({
          id: Math.random().toString(36).substr(2, 9),
          type: 'text',
          view: currentView,
          color: currentColor,
          number: 0,
          x: textModal.x,
          y: textModal.y,
          text: pendingText.trim(),
        });
      }
    }
    setTextModal({ ...textModal, open: false, id: undefined });
    setPendingText('');
  };

  const resetView = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  React.useEffect(() => {
    const updateSize = () => {
      if (canvasContainerRef.current) {
        setContainerSize({
          width: canvasContainerRef.current.clientWidth,
          height: canvasContainerRef.current.clientHeight
        });
      }
    };
    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const addAnnotation = useCallback((ann: Annotation) => {
    setState(prev => ({
      ...prev,
      annotations: [...prev.annotations, { ...ann, number: prev.nextNumber }],
      nextNumber: prev.nextNumber + 1,
    }));
  }, []);

  const removeAnnotation = (id: string) => {
    setState(prev => ({
      ...prev,
      annotations: prev.annotations.filter(a => a.id !== id),
    }));
  };

  const updateAnnotation = (id: string, updates: any) => {
    setState(prev => ({
      ...prev,
      annotations: prev.annotations.map(a => a.id === id ? { ...a, ...updates } : a),
    }));
  };

  const updateAnnotationNotes = (id: string, notes: string) => {
    setState(prev => ({
      ...prev,
      annotations: prev.annotations.map(a => a.id === id ? { ...a, notes } : a),
    }));
  };

  const toggleCritical = (id: string) => {
    setState(prev => ({
      ...prev,
      annotations: prev.annotations.map(a => a.id === id ? { ...a, isCritical: !a.isCritical } : a),
    }));
  };

  const allAnnotationsWithNumbers = useMemo(() => {
    const numbered = state.annotations
      .filter(ann => ann.type !== 'text' && ann.type !== 'arrow')
      .sort((a, b) => {
        const getPriority = (ann: Annotation) => {
          if (ann.isCritical && ann.type === 'crack') return 1;
          if (ann.isCritical && ann.type === 'area') return 2;
          if (!ann.isCritical && ann.type === 'crack') return 3;
          if (!ann.isCritical && ann.type === 'area') return 4;
          return 5;
        };
        
        const pA = getPriority(a);
        const pB = getPriority(b);
        
        if (pA !== pB) return pA - pB;
        return a.number - b.number;
      });

    const numberedMap = new Map(numbered.map((ann, index) => [ann.id, index + 1]));

    return state.annotations.map(ann => ({
      ...ann,
      displayNumber: numberedMap.get(ann.id)
    }));
  }, [state.annotations]);

  const numberedAnnotations = useMemo(() => {
    return allAnnotationsWithNumbers
      .filter(ann => ann.displayNumber !== undefined)
      .sort((a, b) => (a.displayNumber || 0) - (b.displayNumber || 0));
  }, [allAnnotationsWithNumbers]);

  const undo = () => {
    setState(prev => {
      if (prev.annotations.length === 0) return prev;
      const newAnnotations = [...prev.annotations];
      newAnnotations.pop();
      return {
        ...prev,
        annotations: newAnnotations,
        nextNumber: prev.nextNumber - 1,
      };
    });
  };

  const exportToPDF = async () => {
    setIsExporting(true);
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const viewsToCapture: ('front' | 'back')[] = ['front', 'back'];
    
    // Add Page 1: Metadata & Registry
    doc.setFillColor(228, 227, 224); // --background: #E4E3E0
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    
    doc.setTextColor(20, 20, 20); // --foreground: #141414
    doc.setFont('courier', 'bold');
    doc.setFontSize(24);
    doc.text(state.instrumentName.toUpperCase(), 20, 40);
    
    doc.setFont('times', 'italic');
    doc.setFontSize(14);
    doc.text('Condition Mapping Report', 20, 50);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 60);
    
    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(0.5);
    doc.line(20, 65, pageWidth - 20, 65);

    doc.setFont('times', 'italic');
    doc.setFontSize(16);
    doc.text('Condition Registry', 20, 80);
    
    let yPos = 95;
    numberedAnnotations.forEach((ann) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(10);
      doc.setFont('courier', 'bold');
      doc.setTextColor(ann.isCritical ? 178 : 20, ann.isCritical ? 34 : 20, ann.isCritical ? 34 : 20);
      doc.text(`${ann.displayNumber.toString().padStart(2, '0')}${ann.isCritical ? ' [CRITICAL]' : ''}`, 20, yPos);
      
      doc.setTextColor(20, 20, 20);
      doc.setFont('helvetica', 'bold');
      doc.text(`${ann.type.toUpperCase()} [${ann.view}]`, 30, yPos + (ann.isCritical ? 5 : 0));
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const noteText = ann.notes || 'No specific details provided.';
      const splitNotes = doc.splitTextToSize(noteText, pageWidth - 50);
      doc.text(splitNotes, 30, yPos + (ann.isCritical ? 10 : 5));
      
      yPos += (ann.isCritical ? 15 : 10) + (splitNotes.length * 4);
      
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.1);
      doc.line(20, yPos - 2, pageWidth - 20, yPos - 2);
      yPos += 5;
    });

    // Subsequent Pages: Canvas Views
    for (let i = 0; i < viewsToCapture.length; i++) {
      const view = viewsToCapture[i];
      setCurrentView(view);
      setZoom(1); // Reset zoom for export
      setPosition({ x: 0, y: 0 }); // Reset position for export
      
      // Wait for re-render and image loading
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      let imgData;
      const cropX = containerSize.width * 0.25;
      const cropY = containerSize.height * 0.02;
      const cropW = containerSize.width * 0.5;
      const cropH = containerSize.height * 0.96;

      if (stageRef.current) {
        imgData = stageRef.current.toDataURL({ 
          pixelRatio: 3,
          x: cropX,
          y: cropY,
          width: cropW,
          height: cropH
        });
      } else {
        const canvas = await html2canvas(canvasContainerRef.current!);
        imgData = canvas.toDataURL('image/png');
      }
      
      doc.addPage();
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      
      doc.setFont('times', 'italic');
      doc.setFontSize(12);
      doc.text(`${view.toUpperCase()} VIEW`, 20, 15);
      
      const imgWidth = pageWidth - 40;
      const canvasAspectRatio = cropH / cropW;
      const imgHeight = imgWidth * canvasAspectRatio;
      
      let yOffset = 20;
      if (imgHeight > pageHeight - 40) {
        const scale = (pageHeight - 40) / imgHeight;
        doc.addImage(imgData, 'PNG', 20, yOffset, imgWidth * scale, pageHeight - 40);
      } else {
        doc.addImage(imgData, 'PNG', 20, yOffset, imgWidth, imgHeight);
      }
    }
    setIsExporting(false);

    doc.save(`${state.instrumentName.replace(/\s+/g, '_')}_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <TooltipProvider>
      <div className="grid grid-cols-[220px_1fr_280px] grid-rows-[60px_1fr_50px] h-screen w-screen bg-background text-foreground font-sans overflow-hidden">
        {/* Header Area */}
        <header className="col-span-3 border-b-2 border-border flex items-center px-5 gap-10 bg-card">
          <div className="font-mono font-bold text-lg tracking-tight">Condition Report</div>
          <div className="text-[10px] uppercase tracking-[0.1em] opacity-70 font-medium">
            Luthier Annotation Workspace / Last updated: 14/04/2026
          </div>
        </header>

        {/* Toolbox Side (Left) */}
        <aside className="border-r border-border p-5 flex flex-col gap-6 bg-background overflow-y-auto">
          <div className="flex flex-col gap-2">
            <Label className="font-serif italic text-[11px] uppercase opacity-60">Instrument Name</Label>
            <Input 
              value={state.instrumentName}
              onChange={(e) => setState(prev => ({ ...prev, instrumentName: e.target.value }))}
              className="h-8 text-[11px] font-bold tracking-wider border-border bg-stone-200/30 rounded-none"
              placeholder="Client Name / Violin Name"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="font-serif italic text-[11px] uppercase opacity-60">Zoom & Navigation</Label>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 bg-stone-200/30 border border-border p-1 shadow-sm">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}>
                  <Minus className="w-4 h-4" />
                </Button>
                <div className="flex items-center px-2 text-[10px] font-mono font-bold min-w-[40px] justify-center">
                  {Math.round(zoom * 100)}%
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(5, z + 0.2))}>
                  <Plus className="w-4 h-4" />
                </Button>
                <Separator orientation="vertical" className="h-4 my-auto mx-1" />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`h-7 w-7 ${currentTool === 'none' ? 'bg-primary/10 text-primary' : ''}`} 
                  onClick={() => setCurrentTool('none')}
                  title="Pan Tool"
                >
                  <Layers className="w-4 h-4" />
                </Button>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-[10px] uppercase font-bold rounded-none border-border w-full"
                onClick={resetView}
              >
                Center View
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="font-serif italic text-[11px] uppercase opacity-60">Sides</div>
            <Tabs value={currentView} onValueChange={(v) => setCurrentView(v as any)}>
              <TabsList className="w-full bg-stone-200/50 p-1 h-8 rounded-none border border-border">
                {VIEWS.map(v => (
                  <TabsTrigger 
                    key={v.id} 
                    value={v.id} 
                    className="flex-1 text-[9px] uppercase tracking-wider font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-none"
                  >
                    {v.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="flex flex-col gap-2">
            <div className="font-serif italic text-[11px] uppercase opacity-60">Mapping Tools</div>
            <div className="flex flex-col gap-2">
              <Button 
                variant={currentTool === 'crack' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setCurrentTool('crack')}
                className={`justify-start gap-2 text-[13px] h-9 rounded-none border-border ${currentTool === 'crack' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}
              >
                <PenTool className="w-3.5 h-3.5" /> Crack Line
              </Button>
              <Button 
                variant={currentTool === 'area' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setCurrentTool('area')}
                className={`justify-start gap-2 text-[13px] h-9 rounded-none border-border ${currentTool === 'area' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}
              >
                <Square className="w-3.5 h-3.5" /> Area Highlight
              </Button>
              <Button 
                variant={currentTool === 'text' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setCurrentTool('text')}
                className={`justify-start gap-2 text-[13px] h-9 rounded-none border-border ${currentTool === 'text' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}
              >
                <Type className="w-3.5 h-3.5" /> Text Note
              </Button>
              <Button 
                variant={currentTool === 'arrow' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setCurrentTool('arrow')}
                className={`justify-start gap-2 text-[13px] h-9 rounded-none border-border ${currentTool === 'arrow' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}
              >
                <ArrowRight className="w-3.5 h-3.5" /> Annotation Arrow
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="font-serif italic text-[11px] uppercase opacity-60">Properties</div>
            
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setCurrentColor(c.value)}
                    className={`w-6 h-6 border transition-all ${currentColor === c.value ? 'border-primary scale-110 ring-1 ring-primary' : 'border-border opacity-60 hover:opacity-100'}`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            {currentTool === 'crack' && (
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold opacity-70">Width</Label>
                <div className="flex flex-col gap-1">
                  {WIDTH_OPTIONS.map(opt => (
                    <Button
                      key={opt.id}
                      variant={currentWidth === opt.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentWidth(opt.value)}
                      className={`h-7 text-[10px] uppercase font-bold rounded-none border-border ${currentWidth === opt.value ? 'bg-primary text-primary-foreground' : 'bg-card'}`}
                    >
                      {opt.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Area hatch options removed - always solid */}
          </div>

          <div className="mt-auto pt-6 flex flex-col gap-2">
            <Button variant="outline" className="w-full gap-2 text-[10px] uppercase font-bold rounded-none border-border h-8" onClick={undo}>
              <Undo2 className="w-3 h-3" /> Undo Last
            </Button>
          </div>
        </aside>

        {/* Canvas Area (Center) */}
        <main className="relative bg-stone-100 overflow-hidden flex flex-col">
          <div ref={canvasContainerRef} className="flex-1 relative m-4 bg-card border border-border shadow-inner overflow-hidden">
            <LuthierCanvas
              ref={stageRef}
              width={containerSize.width}
              height={containerSize.height}
              view={currentView}
              annotations={allAnnotationsWithNumbers as any}
              onAddAnnotation={addAnnotation}
              currentTool={currentTool}
              currentColor={currentColor}
              currentWidth={currentWidth}
              currentHatch={currentHatch}
              scale={zoom}
              onScaleChange={setZoom}
              position={position}
              onPositionChange={setPosition}
              onTextToolClick={(x, y) => setTextModal({ x, y, open: true, id: undefined })}
              onUpdateAnnotation={updateAnnotation}
              onEditText={(ann) => {
                if (ann.type === 'text') {
                  setPendingText(ann.text);
                  setTextModal({ x: ann.x, y: ann.y, open: true, id: ann.id });
                }
              }}
              hideGuides={isExporting}
            />
          </div>

          {textModal.open && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
              <Card className="w-[300px] p-4 shadow-xl border-2 border-primary rounded-none">
                <div className="flex flex-col gap-4">
                  <div className="text-[11px] uppercase font-bold tracking-wider opacity-60">
                    {textModal.id ? 'Edit Text Annotation' : 'Add Text Annotation'}
                  </div>
                  <textarea
                    autoFocus
                    placeholder="Type your note here..."
                    value={pendingText}
                    onChange={(e) => setPendingText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setTextModal({ ...textModal, open: false, id: undefined });
                        setPendingText('');
                      }
                    }}
                    className="w-full h-32 p-2 text-sm rounded-none border border-stone-300 focus:outline-none focus:border-primary resize-none font-sans"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-[10px] uppercase font-bold rounded-none h-8"
                      onClick={() => {
                        setTextModal({ ...textModal, open: false, id: undefined });
                        setPendingText('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      size="sm" 
                      className="text-[10px] uppercase font-bold rounded-none h-8 bg-primary text-primary-foreground px-4"
                      onClick={handleTextSubmit}
                    >
                      {textModal.id ? 'Save Changes' : 'Add Note'}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </main>

        {/* Condition Table (Right) */}
        <aside className="border-l border-border bg-card flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-border font-serif italic text-sm shrink-0">
            Condition Report
          </div>

          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="flex flex-col">
                {numberedAnnotations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-stone-300 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest">No entries</p>
                  </div>
                ) : (
                  numberedAnnotations.map((ann) => (
                    <div key={ann.id} className={`p-3 border-b border-stone-100 flex gap-3 hover:bg-stone-50 transition-colors group ${ann.isCritical ? 'bg-red-50/50' : ''}`}>
                      <div className="flex flex-col items-center gap-2">
                        <div className={`font-mono font-bold text-sm pt-0.5 ${ann.isCritical ? 'text-destructive' : 'text-accent'}`}>
                          {ann.displayNumber?.toString().padStart(2, '0')}
                        </div>
                        <button 
                          onClick={() => toggleCritical(ann.id)}
                          className={`text-[8px] font-bold px-1 py-0.5 rounded-none border transition-colors uppercase tracking-tighter ${
                            ann.isCritical 
                              ? 'bg-destructive text-white border-destructive' 
                              : 'bg-transparent text-stone-400 border-stone-200 hover:border-destructive hover:text-destructive'
                          }`}
                          title={ann.isCritical ? 'Click to mark as Normal' : 'Click to mark as Critical'}
                        >
                          {ann.isCritical ? 'Crit' : 'Norm'}
                        </button>
                      </div>
                      <div className="flex-1 flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <div className={`text-[10px] font-bold uppercase tracking-tight ${ann.isCritical ? 'text-destructive' : ''}`}>
                            {ann.type} {ann.isCritical && '• CRITICAL'}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 text-stone-300 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeAnnotation(ann.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="text-[10px] text-stone-500 uppercase font-medium">{ann.view} view</div>
                        <Input
                          placeholder="Condition details..."
                          className="text-[11px] border-none bg-stone-50/50 focus-visible:ring-0 h-7 px-2 rounded-none mt-1"
                          value={ann.notes || ''}
                          onChange={(e) => updateAnnotationNotes(ann.id, e.target.value)}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="p-4 border-t border-border bg-stone-50/50 text-[11px] space-y-1 shrink-0">
            <div className="font-bold">Summary:</div>
            <div className="opacity-70">{state.annotations.length} Annotations total</div>
            <div className="opacity-70 text-destructive font-bold">Critical Issues: {state.annotations.filter(a => a.isCritical).length}</div>
          </div>
        </aside>

        {/* Footer */}
        <footer className="col-span-3 border-t border-border flex justify-between items-center px-5 text-[11px] bg-card">
          <div className="opacity-60">Drafting Mode: Enabled / Coordinate System: mm / Grid: Off</div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-7 px-3 text-[10px] uppercase font-bold rounded-none border-border">
              Save Session
            </Button>
            <Button className="h-7 px-3 text-[10px] uppercase font-bold rounded-none bg-primary text-primary-foreground" onClick={exportToPDF}>
              Export PDF Report
            </Button>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}
