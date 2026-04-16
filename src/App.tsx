/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { 
  FileDown, 
  FileUp,
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
import { Annotation, ViolinState, ViewDefinition, ViewType } from './types';
import { COLORS, HATCH_PATTERNS, VIEWS, TOOL_TYPES, WIDTH_OPTIONS } from './constants';
import LuthierCanvas from './components/LuthierCanvas';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const DEVELOPER_INFO = "Developed by Vitalii Vrublevskyi (vitalii.vrublevskyi@gmail.com)";

export default function App() {
  const [state, setState] = useState<ViolinState>({
    annotations: [],
    views: [
      { id: 'view-front-1', type: 'front', isInternal: false, order: 1 },
      { id: 'view-back-1', type: 'back', isInternal: false, order: 2 },
      { id: 'view-ribs-1', type: 'ribs', isInternal: false, order: 3 },
      { id: 'view-scroll-1', type: 'scroll', isInternal: false, order: 4 },
    ],
    nextNumber: 1,
    instrumentName: 'Messiah Stradivarius',
    luthierName: 'Vitaliy Vrublevskiy',
  });
  const [currentView, setCurrentView] = useState<string>('view-front-1');
  const [currentTool, setCurrentTool] = useState<string>('none');
  const [currentColor, setCurrentColor] = useState<string>(COLORS[0].value);
  const [currentWidth, setCurrentWidth] = useState<number>(1);
  const [currentHatch, setCurrentHatch] = useState<string>('none');
  const [zoom, setZoom] = useState<number>(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [textModal, setTextModal] = useState<{ x: number, y: number, open: boolean, id?: string }>({ x: 0, y: 0, open: false });
  const [pendingText, setPendingText] = useState('');
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingViewName, setEditingViewName] = useState('');
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [containerSize, setContainerSize] = useState({ width: 800, height: 1000 });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedAnnotation = useMemo(() => 
    state.annotations.find(a => a.id === selectedId), 
    [state.annotations, selectedId]
  );

  const getViewName = useCallback((view: ViewDefinition, views: ViewDefinition[]) => {
    if (view.name) return view.name;

    const typeViews = views.filter(v => v.type === view.type);
    const typeIndex = typeViews.findIndex(v => v.id === view.id) + 1;
    const baseName = view.type.charAt(0).toUpperCase() + view.type.slice(1);
    
    let name = baseName;
    if (typeViews.length > 1) {
      name += ` ${typeIndex}`;
    }
    if (view.isInternal) {
      name += ` Internal`;
    }
    return name;
  }, []);

  const updateViewName = (id: string, name: string) => {
    setState(prev => ({
      ...prev,
      views: prev.views.map(v => v.id === id ? { ...v, name: name.trim() || undefined } : v)
    }));
    setEditingViewId(null);
  };

  const addView = (type: ViewType) => {
    const id = `view-${type}-${Math.random().toString(36).substr(2, 9)}`;
    const newView: ViewDefinition = {
      id,
      type,
      isInternal: false,
      order: state.views.length + 1
    };
    setState(prev => ({
      ...prev,
      views: [...prev.views, newView]
    }));
    setCurrentView(id);
  };

  const removeView = (id: string) => {
    if (state.views.length <= 1) return;
    setState(prev => ({
      ...prev,
      views: prev.views.filter(v => v.id !== id),
      annotations: prev.annotations.filter(a => a.view !== id)
    }));
    if (currentView === id) {
      setCurrentView(state.views.find(v => v.id !== id)?.id || '');
    }
  };

  const toggleViewInternal = (id: string) => {
    setState(prev => ({
      ...prev,
      views: prev.views.map(v => v.id === id ? { ...v, isInternal: !v.isInternal } : v)
    }));
  };

  const sortedViews = useMemo(() => {
    const orderMap: Record<string, number> = { front: 1, back: 2, ribs: 3, scroll: 4 };
    return [...state.views].sort((a, b) => {
      if (a.type !== b.type) {
        return (orderMap[a.type] || 99) - (orderMap[b.type] || 99);
      }
      return a.order - b.order;
    });
  }, [state.views]);

  const currentViewDef = useMemo(() => 
    state.views.find(v => v.id === currentView) || state.views[0],
    [state.views, currentView]
  );

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
      .filter(ann => ann.type !== 'text')
      .sort((a, b) => {
        const getPriority = (ann: Annotation) => {
          if (ann.isCritical && ann.type === 'crack') return 1;
          if (ann.isCritical && ann.type === 'area') return 2;
          if (ann.isCritical && ann.type === 'arrow') return 3;
          if (!ann.isCritical && ann.type === 'crack') return 4;
          if (!ann.isCritical && ann.type === 'area') return 5;
          if (!ann.isCritical && ann.type === 'arrow') return 6;
          return 7;
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
    const viewsToCapture = sortedViews;
    
    // Add Page 1: Metadata & Registry
    doc.setFillColor(228, 227, 224); // --background: #E4E3E0
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    
    // Add developer info at the bottom of page 1
    doc.setFont('times', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(DEVELOPER_INFO, pageWidth - 10, pageHeight - 5, { align: 'right' });
    
    doc.setTextColor(20, 20, 20); // --foreground: #141414
    doc.setFont('courier', 'bold');
    doc.setFontSize(24);
    doc.text(state.instrumentName.toUpperCase(), 20, 40);
    
    doc.setFont('times', 'italic');
    doc.setFontSize(14);
    doc.text('Condition Mapping Report', 20, 50);
    doc.text(`Luthier: ${state.luthierName}`, 20, 60);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 70);
    
    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(0.5);
    doc.line(20, 75, pageWidth - 20, 75);

    doc.setFont('times', 'italic');
    doc.setFontSize(16);
    doc.text('Condition Registry', 20, 90);
    
    let yPos = 105;
    numberedAnnotations.forEach((ann) => {
      if (yPos > 270) {
        doc.addPage();
        doc.setFont('times', 'italic');
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`${state.instrumentName.toUpperCase()} - ${state.luthierName}`, 10, 10);
        
        doc.setFont('times', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(DEVELOPER_INFO, pageWidth - 10, pageHeight - 5, { align: 'right' });
        
        yPos = 25;
      }
      
      const viewDef = state.views.find(v => v.id === ann.view);
      const viewLabel = viewDef ? getViewName(viewDef, state.views) : 'Unknown View';

      doc.setFontSize(10);
      doc.setFont('courier', 'bold');
      doc.setTextColor(ann.isCritical ? 178 : 20, ann.isCritical ? 34 : 20, ann.isCritical ? 34 : 20);
      doc.text(`${ann.displayNumber.toString().padStart(2, '0')}${ann.isCritical ? ' [CRITICAL]' : ''}`, 20, yPos);
      
      doc.setTextColor(20, 20, 20);
      doc.setFont('helvetica', 'bold');
      doc.text(`${ann.type.toUpperCase()} [${viewLabel}]`, 30, yPos + (ann.isCritical ? 5 : 0));
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const noteText = ann.notes || '';
      if (noteText) {
        const splitNotes = doc.splitTextToSize(noteText, pageWidth - 50);
        doc.text(splitNotes, 30, yPos + (ann.isCritical ? 10 : 5));
        yPos += (ann.isCritical ? 15 : 10) + (splitNotes.length * 4);
      } else {
        yPos += (ann.isCritical ? 12 : 8);
      }
      
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.1);
      doc.line(20, yPos - 2, pageWidth - 20, yPos - 2);
      yPos += 5;
    });

    // Subsequent Pages: Canvas Views
    for (let i = 0; i < viewsToCapture.length; i++) {
      const viewDef = viewsToCapture[i];
      const viewLabel = getViewName(viewDef, state.views);
      setCurrentView(viewDef.id);
      setZoom(1); // Reset zoom for export
      setPosition({ x: 0, y: 0 }); // Reset position for export
      
      // Wait for re-render and image loading
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      let imgData;
      let finalCropW = containerSize.width * 0.92;
      let finalCropH = containerSize.height * 0.96;

      if (stageRef.current) {
        // Find the actual bounds of the instrument and annotations
        const box = stageRef.current.getClientRect({ skipTransform: false });
        
        // Add a small padding to the box
        const padding = 5;
        const finalX = Math.max(0, box.x - padding);
        const finalY = Math.max(0, box.y - padding);
        const finalW = Math.min(containerSize.width - finalX, box.width + padding * 2);
        const finalH = Math.min(containerSize.height - finalY, box.height + padding * 2);

        imgData = stageRef.current.toDataURL({ 
          pixelRatio: 3,
          x: finalX,
          y: finalY,
          width: finalW,
          height: finalH
        });
        
        finalCropW = finalW;
        finalCropH = finalH;
      } else {
        const canvas = await html2canvas(canvasContainerRef.current!);
        imgData = canvas.toDataURL('image/png');
      }
      
      doc.addPage();
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      
      doc.setFont('times', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`${state.instrumentName.toUpperCase()} - ${state.luthierName}`, 10, 10);
      
      doc.setFont('times', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(DEVELOPER_INFO, pageWidth - 10, pageHeight - 5, { align: 'right' });
      
      doc.setFontSize(14);
      doc.setTextColor(20, 20, 20);
      doc.text(`${viewLabel.toUpperCase()}`, pageWidth / 2, 12, { align: 'center' });
      
      const margin = 5;
      const availableWidth = pageWidth - (margin * 2);
      const availableHeight = pageHeight - 20; // Space for title and bottom margin
      
      const canvasAspectRatio = finalCropH / finalCropW;
      
      let finalWidth = availableWidth;
      let finalHeight = availableWidth * canvasAspectRatio;
      
      if (finalHeight > availableHeight) {
        finalHeight = availableHeight;
        finalWidth = finalHeight / canvasAspectRatio;
      }
      
      doc.addImage(imgData, 'PNG', (pageWidth - finalWidth) / 2, 16, finalWidth, finalHeight);
    }

    // Add Internal Repair Summary Page (at the end)
    doc.addPage();
    doc.setFillColor(252, 252, 251);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    
    doc.setTextColor(20, 20, 20);
    doc.setFont('courier', 'bold');
    doc.setFontSize(22);
    doc.text('INTERNAL REPAIR SUMMARY', pageWidth / 2, 25, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120, 110, 100);
    doc.text('Workshop Use Only - Confidential', pageWidth / 2, 32, { align: 'center' });
    
    doc.setFont('times', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(DEVELOPER_INFO, pageWidth - 10, pageHeight - 5, { align: 'right' });
    
    let summaryY = 45;
    
    sortedViews.forEach((view) => {
      const viewAnnotations = numberedAnnotations.filter(ann => ann.view === view.id);
      if (viewAnnotations.length === 0) return;
      
      if (summaryY > 250) {
        doc.addPage();
        summaryY = 30;
      }
      
      const viewLabel = getViewName(view, state.views);
      const viewTotalHours = viewAnnotations.reduce((sum, ann) => sum + (ann.repairHours || 0), 0);
      
      // Group Header
      doc.setFillColor(235, 230, 225);
      doc.rect(20, summaryY - 6, pageWidth - 40, 9, 'F');
      doc.setTextColor(20, 20, 20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(viewLabel.toUpperCase(), 25, summaryY);
      doc.text(`${viewTotalHours.toFixed(1)} HRS`, pageWidth - 25, summaryY, { align: 'right' });
      
      summaryY += 10;
      
      // Table Header
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('NO.', 25, summaryY);
      doc.text('DESCRIPTION', 35, summaryY);
      doc.text('NOTES', 80, summaryY);
      doc.text('HOURS', pageWidth - 25, summaryY, { align: 'right' });
      
      summaryY += 3;
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.1);
      doc.line(20, summaryY, pageWidth - 20, summaryY);
      summaryY += 6;
      
      doc.setTextColor(20, 20, 20);
      viewAnnotations.forEach((ann) => {
        if (summaryY > 275) {
          doc.addPage();
          summaryY = 30;
        }
        
        doc.setFont('courier', 'bold');
        doc.setFontSize(9);
        doc.text(ann.displayNumber.toString().padStart(2, '0'), 25, summaryY);
        
        doc.setFont('helvetica', 'bold');
        doc.text(ann.type.toUpperCase(), 35, summaryY);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const notes = ann.notes || '-';
        const splitNotes = doc.splitTextToSize(notes, pageWidth - 115);
        doc.text(splitNotes, 80, summaryY);
        
        doc.setFont('courier', 'bold');
        doc.text((ann.repairHours || 0).toFixed(1), pageWidth - 25, summaryY, { align: 'right' });
        
        summaryY += Math.max(7, splitNotes.length * 4);
        
        // Minor separator
        doc.setDrawColor(240, 240, 240);
        doc.line(25, summaryY - 2, pageWidth - 25, summaryY - 2);
        summaryY += 1;
      });
      
      summaryY += 8;
    });

    const grandTotal = numberedAnnotations.reduce((sum, ann) => sum + (ann.repairHours || 0), 0);
    
    if (summaryY > 260) {
      doc.addPage();
      summaryY = 40;
    }
    
    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(0.5);
    doc.line(20, summaryY, pageWidth - 20, summaryY);
    summaryY += 10;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`TOTAL ESTIMATED LABOR: ${grandTotal.toFixed(1)} HOURS`, pageWidth - 20, summaryY, { align: 'right' });

    setIsExporting(false);

    doc.save(`${state.instrumentName.replace(/\s+/g, '_')}_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const saveSession = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `${state.instrumentName.replace(/\s+/g, '_')}_session.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.views && json.annotations) {
          setState(json);
          if (json.views.length > 0) {
            setCurrentView(json.views[0].id);
          }
        } else {
          // Fallback or better validation could go here
        }
      } catch (err) {
        console.error('Error loading session:', err);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
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
              placeholder="Violin Name"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="font-serif italic text-[11px] uppercase opacity-60">Luthier Name</Label>
            <Input 
              value={state.luthierName}
              onChange={(e) => setState(prev => ({ ...prev, luthierName: e.target.value }))}
              className="h-8 text-[11px] font-bold tracking-wider border-border bg-stone-200/30 rounded-none"
              placeholder="Luthier Name"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="font-serif italic text-[11px] uppercase opacity-60">Zoom & Navigation</Label>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 bg-stone-200/30 border border-border p-1 shadow-sm justify-center items-center">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}>
                  <Minus className="w-4 h-4" />
                </Button>
                <div className="flex items-center px-2 text-[10px] font-mono font-bold min-w-[40px] justify-center">
                  {Math.round(zoom * 100)}%
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(5, z + 0.2))}>
                  <Plus className="w-4 h-4" />
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
            <div className="flex justify-between items-center">
              <div className="font-serif italic text-[11px] uppercase opacity-60">Mapping Sheets</div>
              <Tooltip>
                <TooltipTrigger>
                  <Button variant="ghost" size="icon" className="h-5 w-5 opacity-40 hover:opacity-100" onClick={() => addView(currentViewDef.type)}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add another sheet of this side</TooltipContent>
              </Tooltip>
            </div>
            
            <div className="flex flex-col gap-1 max-h-[250px] overflow-y-auto pr-1">
              {sortedViews.map(v => (
                <div key={v.id} className="flex gap-1 group">
                    {editingViewId === v.id ? (
                      <div className="flex-1 flex gap-1">
                        <Input
                          autoFocus
                          value={editingViewName}
                          onChange={(e) => setEditingViewName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') updateViewName(v.id, editingViewName);
                            if (e.key === 'Escape') setEditingViewId(null);
                          }}
                          className="h-8 text-[10px] uppercase font-bold px-2 py-0 border-primary focus-visible:ring-0"
                        />
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-primary shadow-none"
                          onClick={() => updateViewName(v.id, editingViewName)}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setCurrentView(v.id)}
                        onDoubleClick={() => {
                          setEditingViewId(v.id);
                          setEditingViewName(getViewName(v, state.views));
                        }}
                        className={`flex-1 h-8 text-[10px] uppercase font-bold transition-all flex items-center px-3 border border-stone-200/50 ${
                          currentView === v.id 
                            ? 'bg-primary text-primary-foreground border-primary' 
                            : 'bg-stone-200/30 hover:bg-stone-300/50 text-foreground/70'
                        }`}
                      >
                        <span className="flex-1 text-left truncate">{getViewName(v, state.views)}</span>
                        {v.isInternal && (
                          <span className="ml-2 text-[8px] bg-orange-500 text-white px-1 py-0.5 rounded-none leading-none">INT</span>
                        )}
                      </button>
                    )}
                  
                  {currentView === v.id && editingViewId !== v.id && (
                    <div className="flex gap-1">
                      <Tooltip>
                        <TooltipTrigger>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className={`h-8 w-8 rounded-none border-stone-200 ${v.isInternal ? 'bg-orange-100 text-orange-700' : ''}`}
                            onClick={() => toggleViewInternal(v.id)}
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{v.isInternal ? 'Switch to External' : 'Switch to Internal'}</TooltipContent>
                      </Tooltip>
                      {state.views.filter(view => view.type === v.type).length > 1 && (
                         <Button 
                         variant="outline" 
                         size="icon" 
                         className="h-8 w-8 rounded-none border-stone-200 text-stone-300 hover:text-destructive"
                         onClick={() => removeView(v.id)}
                       >
                         <Minus className="w-3.5 h-3.5" />
                       </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Separator className="my-1 opacity-20" />
            
            <div className="grid grid-cols-2 gap-1 px-1">
              {VIEWS.map(v => (
                <button
                  key={v.id}
                  onClick={() => {
                    const existing = state.views.find(view => view.type === v.id);
                    if (existing) setCurrentView(existing.id);
                    else addView(v.id as any);
                  }}
                  className={`h-6 text-[9px] uppercase font-medium transition-all flex items-center justify-center border ${
                    currentViewDef.type === v.id 
                      ? 'bg-stone-400 text-white' 
                      : 'border-stone-200 text-stone-500 hover:bg-stone-100'
                  }`}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="font-serif italic text-[11px] uppercase opacity-60">Mapping Tools</div>
            <div className="flex flex-col gap-2">
              <Button 
                variant={currentTool === 'none' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setCurrentTool('none')}
                className={`justify-start gap-2 text-[13px] h-9 rounded-none border-border ${currentTool === 'none' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}
              >
                <Layers className="w-3.5 h-3.5" /> Pan & Select
              </Button>
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
            <div className="font-serif italic text-[11px] uppercase opacity-60">
              {selectedAnnotation ? `Editing Annotation #${selectedAnnotation.displayNumber || selectedAnnotation.number}` : 'Global Properties'}
            </div>
            
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold opacity-70">Color</Label>
              <div className="flex flex-wrap gap-1">
                {COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => {
                      if (selectedAnnotation) {
                        updateAnnotation(selectedAnnotation.id, { color: c.value });
                      } else {
                        setCurrentColor(c.value);
                      }
                    }}
                    className={`w-6 h-6 border transition-all ${
                      (selectedAnnotation ? selectedAnnotation.color === c.value : currentColor === c.value) 
                        ? 'border-primary scale-110 ring-1 ring-primary' 
                        : 'border-border opacity-60 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            {((selectedAnnotation && selectedAnnotation.type === 'crack') || (!selectedAnnotation && currentTool === 'crack')) && (
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold opacity-70">Width</Label>
                <div className="flex flex-col gap-1">
                  {WIDTH_OPTIONS.map(opt => (
                    <Button
                      key={opt.id}
                      variant={(selectedAnnotation?.type === 'crack' && selectedAnnotation.width === opt.value || (!selectedAnnotation && currentWidth === opt.value)) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        if (selectedAnnotation?.type === 'crack') {
                          updateAnnotation(selectedAnnotation.id, { width: opt.value });
                        } else {
                          setCurrentWidth(opt.value);
                        }
                      }}
                      className={`h-7 text-[10px] uppercase font-bold rounded-none border-border ${
                        (selectedAnnotation?.type === 'crack' && selectedAnnotation.width === opt.value || (!selectedAnnotation && currentWidth === opt.value)) 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-card'
                      }`}
                    >
                      {opt.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            
            {selectedAnnotation && (selectedAnnotation.type === 'crack' || selectedAnnotation.type === 'area') && (
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] uppercase font-bold opacity-70">Curvature / Smoothing</Label>
                  <span className="text-[10px] font-mono opacity-60">
                    {Math.round((selectedAnnotation.tension ?? 0) * 100)}%
                  </span>
                </div>
                <Slider 
                  value={[ (selectedAnnotation.tension ?? 0) * 100 ]}
                  onValueChange={(vals: any) => {
                    const value = Array.isArray(vals) ? vals[0] : vals;
                    const nextVal = typeof value === 'number' ? value / 100 : 0;
                    if (!isNaN(nextVal)) {
                      // Triggering a points copy forces the Canvas to re-evaluate the geometry
                      updateAnnotation(selectedAnnotation.id, { 
                        tension: nextVal,
                        points: [...selectedAnnotation.points] 
                      });
                    }
                  }}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
            )}
            
            {selectedAnnotation && (
              <Button 
                variant="ghost" 
                className="text-[10px] uppercase font-bold h-7 w-full text-stone-400 hover:text-stone-600"
                onClick={() => setSelectedId(null)}
              >
                Done Editing
              </Button>
            )}
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
              viewType={currentViewDef.type}
              isInternal={currentViewDef.isInternal}
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
              selectedId={selectedId}
              onSelect={setSelectedId}
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
                        <div className="text-[10px] text-stone-500 uppercase font-medium">
                          {getViewName(state.views.find(v => v.id === ann.view) || state.views[0], state.views)}
                        </div>
                        <div className="flex gap-2 mt-1">
                          <Input
                            placeholder="Condition details..."
                            className="text-[11px] border-none bg-stone-50/50 focus-visible:ring-0 h-7 px-2 rounded-none flex-1"
                            value={ann.notes || ''}
                            onChange={(e) => updateAnnotationNotes(ann.id, e.target.value)}
                          />
                          <div className="flex items-center gap-1 bg-stone-50/50 px-1 border border-stone-100">
                            <Label className="text-[9px] uppercase font-bold opacity-40">Hrs</Label>
                            <Input
                              type="number"
                              className="text-[11px] border-none bg-transparent focus-visible:ring-0 h-6 w-10 px-1 rounded-none text-center"
                              value={ann.repairHours || ''}
                              onChange={(e) => updateAnnotation(ann.id, { repairHours: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                        </div>
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
          <div className="flex items-center gap-4">
            <div className="opacity-60">Drafting Mode: Enabled / Coordinate System: mm / Grid: Off</div>
            <div className="text-stone-400 italic text-[10px] border-l border-stone-200 pl-4">
              {DEVELOPER_INFO}
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".json"
              onChange={handleFileUpload}
            />
            <Button 
              variant="outline" 
              className="h-7 px-3 text-[10px] uppercase font-bold rounded-none border-border gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="w-3 h-3" /> Import Data
            </Button>
            <Button 
              variant="outline" 
              className="h-7 px-3 text-[10px] uppercase font-bold rounded-none border-border gap-2"
              onClick={saveSession}
            >
              <FileDown className="w-3 h-3" /> Export Data
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
