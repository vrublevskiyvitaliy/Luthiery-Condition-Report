import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Text, Arrow, Image as KonvaImage, Group, Rect, Transformer } from 'react-konva';
import { Annotation, Point } from '@/src/types';
import { regularizePath, regularizeArea } from '../lib/geometry';
import useImage from 'use-image';
import frontSvg from '../front.svg';
import backSvg from '../back.svg';
import ribsSvg from '../ribs.svg';
import scrollSvg from '../scroll.svg';

interface LuthierCanvasProps {
  annotations: Annotation[];
  onAddAnnotation: (annotation: Annotation) => void;
  currentTool: string;
  currentColor: string;
  currentWidth: number;
  currentHatch: string;
  view: string; // View ID
  viewType: 'front' | 'back' | 'ribs' | 'scroll';
  isInternal?: boolean;
  width: number;
  height: number;
  scale: number;
  onScaleChange: (scale: number) => void;
  position: { x: number; y: number };
  onPositionChange: (pos: { x: number; y: number }) => void;
  onTextToolClick?: (x: number, y: number) => void;
  onUpdateAnnotation?: (id: string, updates: Partial<Annotation>) => void;
  onEditText?: (ann: Annotation) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  hideGuides?: boolean;
}

const LuthierCanvas = React.forwardRef<any, LuthierCanvasProps>(({
  annotations,
  onAddAnnotation,
  currentTool,
  currentColor,
  currentWidth,
  currentHatch,
  view,
  viewType,
  isInternal,
  width,
  height,
  scale,
  onScaleChange,
  position,
  onPositionChange,
  onTextToolClick,
  onUpdateAnnotation,
  onEditText,
  selectedId,
  onSelect,
  hideGuides,
}, ref) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState<number[]>([]);
  const transformerRef = useRef<any>(null);

  // Attach transformer to selected node
  useEffect(() => {
    if (selectedId && transformerRef.current) {
      const stage = ref && 'current' in ref ? (ref.current as any) : null;
      if (stage) {
        const ann = annotations.find(a => a.id === selectedId);
        const node = stage.findOne('#' + selectedId);
        // Only attach transformer to text nodes
        if (node && ann?.type === 'text') {
          transformerRef.current.nodes([node]);
          transformerRef.current.forceUpdate();
          transformerRef.current.getLayer().batchDraw();
        } else {
          transformerRef.current.nodes([]);
        }
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
    }
  }, [selectedId, ref, annotations]);

  // Reset cursor and selection when tool changes
  useEffect(() => {
    const stage = ref && 'current' in ref ? (ref.current as any) : null;
    if (stage) {
      const container = stage.container();
      if (currentTool === 'none') {
        container.style.cursor = 'grab';
      } else {
        container.style.cursor = 'crosshair';
        onSelect(null);
      }
    }
  }, [currentTool, ref]);

  // Use provided SVG outlines
  const [frontImage] = useImage(frontSvg);
  const [backImage] = useImage(backSvg);
  const [ribsImage] = useImage(ribsSvg);
  const [scrollImage] = useImage(scrollSvg);

  const currentImage = 
    viewType === 'front' ? frontImage : 
    viewType === 'back' ? backImage : 
    viewType === 'ribs' ? ribsImage : 
    viewType === 'scroll' ? scrollImage : 
    null;

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    
    // Limit zoom
    const clampedScale = Math.max(0.5, Math.min(newScale, 5));
    
    onScaleChange(clampedScale);
    
    const newPos = {
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    };
    onPositionChange(newPos);
  };

  const getImageDimensions = () => {
    if (!currentImage) return { x: 0, y: 0, width, height };
    
    const imgWidth = currentImage.width;
    const imgHeight = currentImage.height;
    const imgRatio = imgWidth / imgHeight;
    const canvasRatio = width / height;
    
    let renderWidth, renderHeight, x, y;
    
    // Fit to safe area (92% width, 96% height)
    const safeWidth = width * 0.92;
    const safeHeight = height * 0.96;
    const safeRatio = safeWidth / safeHeight;

    if (imgRatio < safeRatio) {
      // Fit by height
      renderHeight = safeHeight;
      renderWidth = safeHeight * imgRatio;
    } else {
      // Fit by width
      renderWidth = safeWidth;
      renderHeight = safeWidth / imgRatio;
    }
    
    // Center in the entire canvas
    x = (width - renderWidth) / 2;
    y = (height - renderHeight) / 2;
    
    return { x, y, width: renderWidth, height: renderHeight };
  };

  const imgDim = getImageDimensions();

  const minX = width * 0.04;
  const maxX = width * 0.96;
  const minY = height * 0.02;
  const maxY = height * 0.98;

  const handleMouseDown = (e: any) => {
    if (currentTool === 'none') return;

    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    
    const pos = {
      x: (pointer.x - stage.x()) / stage.scaleX(),
      y: (pointer.y - stage.y()) / stage.scaleY(),
    };

    // Restrict text and arrow creation to safe area
    if (currentTool === 'text' || currentTool === 'arrow') {
      if (pos.x < minX || pos.x > maxX || pos.y < minY || pos.y > maxY) {
        return;
      }
    }

    setIsDrawing(true);

    if (currentTool === 'crack' || currentTool === 'area' || currentTool === 'arrow') {
      setPoints([pos.x, pos.y]);
    } else if (currentTool === 'text') {
      if (onTextToolClick) {
        onTextToolClick(pos.x, pos.y);
      }
      setIsDrawing(false);
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing) return;

    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    const pos = {
      x: (pointer.x - stage.x()) / stage.scaleX(),
      y: (pointer.y - stage.y()) / stage.scaleY(),
    };

    if (currentTool === 'crack' || currentTool === 'area') {
      // Smoothing: only add point if it's far enough from the last point
      const lastX = points[points.length - 2];
      const lastY = points[points.length - 1];
      const dist = Math.sqrt(Math.pow(pos.x - lastX, 2) + Math.pow(pos.y - lastY, 2));
      
      if (dist > 3) { // Reduced distance for more detail while still filtering noise
        setPoints([...points, pos.x, pos.y]);
      }
    } else if (currentTool === 'arrow') {
      // For arrow, we update the last point for preview and clamp to safe area
      const clampedX = Math.max(minX, Math.min(pos.x, maxX));
      const clampedY = Math.max(minY, Math.min(pos.y, maxY));
      setPoints([points[0], points[1], clampedX, clampedY]);
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (points.length < 2) return;

    const id = Math.random().toString(36).substr(2, 9);

    if (currentTool === 'crack') {
      onAddAnnotation({
        id,
        type: 'crack',
        view,
        color: currentColor,
        number: 0,
        points,
        width: currentWidth,
        tension: 0,
      });
    } else if (currentTool === 'area') {
      // For area, we close the path
      const closedPoints = [...points, points[0], points[1]];
      onAddAnnotation({
        id,
        type: 'area',
        view,
        color: currentColor,
        number: 0,
        points: closedPoints,
        hatchPattern: currentHatch as any,
        tension: 0,
      });
    } else if (currentTool === 'arrow') {
      onAddAnnotation({
        id,
        type: 'arrow',
        view,
        color: currentColor,
        number: 0,
        points,
      });
    }

    setPoints([]);
  };

  const renderAnnotation = (ann: Annotation) => {
    if (ann.view !== view) return null;

    const displayNum = ann.displayNumber || ann.number;
    const smoothing = ann.tension || 0; // 0 (raw) to 1 (regularized)

    const handleMouseEnter = (e: any) => {
      if (currentTool === 'none') {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'pointer';
      }
    };

    const handleMouseLeave = (e: any) => {
      if (currentTool === 'none') {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'grab';
      }
    };

    const MarkerPin = ({ num, x, y, color, id }: { num: number; x: number; y: number; color: string; id: string }) => (
      <Group 
        x={x} 
        y={y}
        onClick={(e) => {
          if (currentTool === 'none') {
            e.cancelBubble = true;
            onSelect(id);
          }
        }}
      >
        <Rect
          width={18}
          height={18}
          fill={color}
          cornerRadius={9}
          offsetX={9}
          offsetY={9}
        />
        <Text
          text={num.toString().padStart(2, '0')}
          fill="white"
          fontSize={10}
          fontFamily="Courier New"
          fontStyle="bold"
          width={18}
          align="center"
          offsetX={9}
          offsetY={4}
        />
      </Group>
    );

    switch (ann.type) {
      case 'crack':
        const crackPoints = regularizePath(ann.points, smoothing);
        const markerX = crackPoints[0];
        const markerY = crackPoints[1];

        return (
          <Group 
            key={ann.id}
            id={ann.id}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            draggable={currentTool === 'none'}
            onClick={(e) => {
              if (currentTool === 'none') {
                e.cancelBubble = true;
                onSelect(ann.id);
              }
            }}
            onDragEnd={(e) => {
              if (onUpdateAnnotation) {
                // For lines, we update all points by the drag offset
                const dx = e.target.x();
                const dy = e.target.y();
                const newPoints = ann.points.map((p, i) => i % 2 === 0 ? p + dx : p + dy);
                onUpdateAnnotation(ann.id, { points: newPoints });
                e.target.x(0);
                e.target.y(0);
              }
            }}
          >
             <Line
              points={crackPoints}
              stroke={ann.color}
              strokeWidth={ann.width}
              tension={0} // Using manual regularization
              lineCap="round"
              lineJoin="round"
              shadowColor={(!hideGuides && selectedId === ann.id) ? ann.color : undefined}
              shadowBlur={(!hideGuides && selectedId === ann.id) ? 8 : 0}
            />
            <MarkerPin num={displayNum} x={markerX} y={markerY} color={ann.color} id={ann.id} />
          </Group>
        );
      case 'area':
        const areaPoints = regularizeArea(ann.points, smoothing);
        const areaMarkerX = areaPoints[0];
        const areaMarkerY = areaPoints[1];

        return (
          <Group 
            key={ann.id}
            id={ann.id}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            draggable={currentTool === 'none'}
            onClick={(e) => {
              if (currentTool === 'none') {
                e.cancelBubble = true;
                onSelect(ann.id);
              }
            }}
            onDragEnd={(e) => {
              if (onUpdateAnnotation) {
                const dx = e.target.x();
                const dy = e.target.y();
                const newPoints = ann.points.map((p, i) => i % 2 === 0 ? p + dx : p + dy);
                onUpdateAnnotation(ann.id, { points: newPoints });
                e.target.x(0);
                e.target.y(0);
              }
            }}
          >
             <Line
              points={areaPoints}
              stroke={ann.color}
              strokeWidth={2}
              fill={ann.color + '33'} // Transparent fill
              closed
              tension={0} // Manual regularization
              shadowColor={(!hideGuides && selectedId === ann.id) ? ann.color : undefined}
              shadowBlur={(!hideGuides && selectedId === ann.id) ? 8 : 0}
            />
            <MarkerPin num={displayNum} x={areaMarkerX} y={areaMarkerY} color={ann.color} id={ann.id} />
          </Group>
        );
      case 'text':
        return (
          <Group 
            key={ann.id}
            id={ann.id}
            draggable={currentTool === 'none'}
            dragBoundFunc={(pos) => {
              const stage = ref && 'current' in ref ? (ref.current as any) : null;
              if (!stage) return pos;
              
              const stageX = stage.x();
              const stageY = stage.y();
              const stageScale = stage.scaleX();

              const localMinX = minX * stageScale + stageX;
              const localMaxX = maxX * stageScale + stageX;
              const localMinY = minY * stageScale + stageY;
              const localMaxY = maxY * stageScale + stageY;

              const textWidth = (ann.width || 120) * stageScale;
              const textHeight = (ann.height || 48) * stageScale;

              return {
                x: Math.max(localMinX, Math.min(pos.x, localMaxX - textWidth)),
                y: Math.max(localMinY, Math.min(pos.y, localMaxY - textHeight))
              };
            }}
            onDragEnd={(e) => {
              if (onUpdateAnnotation) {
                onUpdateAnnotation(ann.id, {
                  x: e.target.x(),
                  y: e.target.y()
                });
              }
            }}
            onTransformEnd={(e) => {
              const node = e.target;
              const scaleX = node.scaleX();
              const scaleY = node.scaleY();

              // reset scale
              node.scaleX(1);
              node.scaleY(1);

              if (onUpdateAnnotation) {
                const newWidth = Math.max(50, (ann.width || 120) * scaleX);
                const newHeight = Math.max(20, (ann.height || 48) * scaleY);
                
                onUpdateAnnotation(ann.id, {
                  x: node.x(),
                  y: node.y(),
                  width: newWidth,
                  height: newHeight,
                });
              }
            }}
            onMouseEnter={(e) => {
              if (currentTool === 'none') {
                const container = e.target.getStage()?.container();
                if (container) container.style.cursor = 'move';
              }
            }}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => {
              if (currentTool === 'none') {
                e.cancelBubble = true;
                onSelect(ann.id);
              }
            }}
            onDblClick={() => {
              if (currentTool === 'none' && onEditText) {
                onEditText(ann);
              }
            }}
            x={ann.x}
            y={ann.y}
          >
            <Rect
              width={ann.width || 120}
              height={ann.height || 48}
              fill="rgba(255, 255, 255, 0.2)"
              stroke={ann.color}
              strokeWidth={0.8}
              cornerRadius={6}
              shadowBlur={2}
              shadowOpacity={0.1}
            />
            <Text
              width={ann.width || 120}
              height={ann.height || 48}
              padding={8}
              text={ann.text}
              fontSize={11}
              fill="#334155"
              fontFamily="sans-serif"
              lineHeight={1.2}
              ellipsis={true}
              wrap="char"
            />
          </Group>
        );
      case 'arrow':
        const arrowMarkerX = ann.points[0];
        const arrowMarkerY = ann.points[1];
        const arrowDisplayNum = ann.displayNumber || 0;

        return (
          <Group 
            key={ann.id}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <Arrow
              points={ann.points}
              stroke={ann.color}
              fill={ann.color}
              strokeWidth={2}
              pointerLength={10}
              pointerWidth={10}
            />
            <MarkerPin num={arrowDisplayNum} x={arrowMarkerX} y={arrowMarkerY} color={ann.color} id={ann.id} />
          </Group>
        );
      default:
        return null;
    }
  };

  return (
    <div 
      className={`relative w-full h-full bg-white overflow-hidden ${
        currentTool === 'none' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
      }`}
    >
      <Stage
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        onDragEnd={(e) => {
          if (e.target === e.currentTarget) {
            onPositionChange({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onSelect(null);
          }
        }}
        draggable={currentTool === 'none'}
        ref={ref}
      >
        <Layer>
          {/* Safe Area Guide */}
          {!hideGuides && (
            <Rect
              x={width * 0.04}
              y={height * 0.02}
              width={width * 0.92}
              height={height * 0.96}
              stroke="#64748b"
              strokeWidth={2}
              dash={[8, 4]}
              listening={false}
            />
          )}

          {/* Background Template */}
          {currentImage && (
            <Group>
              <KonvaImage
                image={currentImage}
                x={imgDim.x}
                y={imgDim.y}
                width={imgDim.width}
                height={imgDim.height}
                opacity={0.6}
              />
              {isInternal && (
                <Group listening={false}>
                  <Rect 
                    x={imgDim.x} 
                    y={imgDim.y} 
                    width={imgDim.width} 
                    height={imgDim.height} 
                    fill="#fb923c"
                    opacity={0.08}
                  />
                  <Text 
                    text="INTERNAL VIEW"
                    x={imgDim.x}
                    y={imgDim.y + imgDim.height - 30}
                    width={imgDim.width}
                    fontSize={18}
                    fontFamily="monospace"
                    fontStyle="bold"
                    fill="#fb923c"
                    align="center"
                    opacity={0.8}
                  />
                </Group>
              )}
            </Group>
          )}
          
          {/* Existing Annotations */}
          {annotations.map(renderAnnotation)}

          {/* Transformer for selected text note */}
          {selectedId && currentTool === 'none' && (
            <Transformer
              ref={transformerRef}
              boundBoxFunc={(oldBox, newBox) => {
                // limit resize
                if (newBox.width < 50 || newBox.height < 20) {
                  return oldBox;
                }
                return newBox;
              }}
              rotateEnabled={false}
              padding={2}
              anchorSize={10}
              anchorCornerRadius={5}
              anchorFill="#3b82f6"
              anchorStroke="#fff"
              anchorStrokeWidth={2}
              borderStroke="#3b82f6"
              borderDash={[3, 3]}
            />
          )}

          {/* Preview of current drawing */}
          {isDrawing && (
             <>
               {currentTool === 'crack' && (
                 <Line
                   points={points}
                   stroke={currentColor}
                   strokeWidth={currentWidth}
                   tension={0.5}
                   lineCap="round"
                   lineJoin="round"
                   opacity={0.5}
                 />
               )}
               {currentTool === 'area' && (
                 <Line
                   points={points}
                   stroke={currentColor}
                   strokeWidth={2}
                   fill={currentColor + '22'}
                   closed
                   tension={0.5}
                   opacity={0.5}
                 />
               )}
               {currentTool === 'arrow' && (
                 <Arrow
                   points={points}
                   stroke={currentColor}
                   fill={currentColor}
                   strokeWidth={2}
                   opacity={0.5}
                 />
               )}
             </>
          )}
        </Layer>
      </Stage>
    </div>
  );
});

export default LuthierCanvas;
