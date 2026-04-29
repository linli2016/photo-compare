import type { PhotoEditorRef } from '../components/PhotoEditor';

export async function exportComparison(
  topData: NonNullable<ReturnType<PhotoEditorRef['getExportData']>>,
  bottomData: NonNullable<ReturnType<PhotoEditorRef['getExportData']>>,
  layout: 'horizontal' | 'vertical',
  topLabel: string,
  bottomLabel: string
) {
  if (!topData || !bottomData) {
    alert("Please upload both photos before exporting.");
    return;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const isDesktop = layout === 'horizontal';
  const dpr = Math.max(window.devicePixelRatio || 2, 3); // Guarantee minimum 3x high-res export
  const labelHeight = 24; // Shrink to accurately match the tight 'mt-1.5' screen spacing
  
  // The dimensions of the final canvas
  let totalWidth = 0;
  let totalHeight = 0;
  
  if (isDesktop) {
    totalWidth = topData.containerWidth + bottomData.containerWidth;
    totalHeight = Math.max(topData.containerHeight, bottomData.containerHeight) + labelHeight;
  } else {
    totalWidth = Math.max(topData.containerWidth, bottomData.containerWidth);
    totalHeight = topData.containerHeight + labelHeight + bottomData.containerHeight + labelHeight;
  }

  canvas.width = totalWidth * dpr;
  canvas.height = totalHeight * dpr;
  
  // Fill background
  ctx.fillStyle = '#000000'; // Black background behind images
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Scale for high DPI
  ctx.scale(dpr, dpr);

  const drawDataToCtx = (
    data: NonNullable<ReturnType<PhotoEditorRef['getExportData']>>, 
    targetRect: {x: number, y: number, w: number, h: number}
  ) => {
    const { image, x, y, scale, rotation, containerWidth, containerHeight } = data;
    
    // Calculate object-fit: contain dimensions
    const imgAspect = image.naturalWidth / image.naturalHeight;
    const containerAspect = containerWidth / containerHeight;
    
    let renderWidth = containerWidth;
    let renderHeight = containerHeight;
    
    if (imgAspect > containerAspect) {
      renderHeight = containerWidth / imgAspect;
    } else {
      renderWidth = containerHeight * imgAspect;
    }
    
    ctx.save();
    
    // Clip to container bounds
    ctx.beginPath();
    ctx.rect(targetRect.x, targetRect.y, targetRect.w, targetRect.h);
    ctx.clip();
    
    // Move to the container center in the canvas
    const centerX = targetRect.x + targetRect.w / 2;
    const centerY = targetRect.y + targetRect.h / 2;
    
    ctx.translate(centerX, centerY);
    
    // Apply user transforms (translation, scale, rotation)
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(rotation * Math.PI / 180);
    
    // Setup smoothing for quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw the image centered
    ctx.drawImage(
      image, 
      -renderWidth / 2, 
      -renderHeight / 2, 
      renderWidth, 
      renderHeight
    );
    
    ctx.restore();

    // Draw the grid overlay if it's currently showing
    if (data.showGrid) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(targetRect.x, targetRect.y, targetRect.w, targetRect.h);
      ctx.clip();
      
      // Setup grid lines
      ctx.lineWidth = 1;

      // 10 vertical and horizontal lines
      const stepX = targetRect.w / 10;
      const stepY = targetRect.h / 10;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      for(let i = 1; i < 10; i++) {
        // Vertical lines
        ctx.moveTo(targetRect.x + i * stepX, targetRect.y);
        ctx.lineTo(targetRect.x + i * stepX, targetRect.y + targetRect.h);
        // Horizontal lines
        ctx.moveTo(targetRect.x, targetRect.y + i * stepY);
        ctx.lineTo(targetRect.x + targetRect.w, targetRect.y + i * stepY);
      }
      ctx.stroke();

      // Center crosshairs
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.moveTo(targetRect.x, targetRect.y + targetRect.h / 2);
      ctx.lineTo(targetRect.x + targetRect.w, targetRect.y + targetRect.h / 2);
      ctx.moveTo(targetRect.x + targetRect.w / 2, targetRect.y);
      ctx.lineTo(targetRect.x + targetRect.w / 2, targetRect.y + targetRect.h);
      ctx.stroke();

      ctx.restore();
    }
  };

  // Draw top (or left) image
  drawDataToCtx(topData, {
    x: 0,
    y: 0,
    w: topData.containerWidth,
    h: topData.containerHeight
  });

  // Draw bottom (or right) image
  drawDataToCtx(bottomData, {
    x: isDesktop ? topData.containerWidth : 0,
    y: isDesktop ? 0 : topData.containerHeight + labelHeight,
    w: bottomData.containerWidth,
    h: bottomData.containerHeight
  });

  // Draw the text labels
  ctx.save();
  ctx.fillStyle = '#a1a1aa'; // matching text-zinc-400
  ctx.font = 'bold 12px sans-serif';
  ctx.letterSpacing = '0.1em'; // Approximate tracking-widest
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  if (isDesktop) {
    // Left Label
    ctx.fillText(topLabel.toUpperCase(), topData.containerWidth / 2, topData.containerHeight + labelHeight / 2);
    // Right Label
    ctx.fillText(bottomLabel.toUpperCase(), topData.containerWidth + (bottomData.containerWidth / 2), bottomData.containerHeight + labelHeight / 2);
  } else {
    // Top Label
    ctx.fillText(topLabel.toUpperCase(), totalWidth / 2, topData.containerHeight + labelHeight / 2);
    // Bottom Label
    ctx.fillText(bottomLabel.toUpperCase(), totalWidth / 2, topData.containerHeight + labelHeight + bottomData.containerHeight + labelHeight / 2);
  }
  ctx.restore();

  // Optionally draw a subtle separator line
  ctx.save();
  ctx.fillStyle = 'white';
  ctx.globalAlpha = 0.1;
  if (isDesktop) {
    ctx.fillRect(topData.containerWidth, 0, 1, totalHeight);
  } else {
    ctx.fillRect(0, topData.containerHeight + labelHeight, totalWidth, 1);
  }
  ctx.restore();

  // Export
  try {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
    if (!blob) throw new Error('Canvas toBlob failed');
    
    const fileName = `photo-compare-${new Date().getTime()}.jpg`;
    const file = new File([blob], fileName, { type: 'image/jpeg' });

    // Try native share (iOS Safari Camera Roll / Android Share)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Photo Comparison',
        });
        return; // Success, bail out
      } catch (shareErr: any) {
        // If user actively cancels the share sheet, do not fallback to download
        if (shareErr.name === 'AbortError') return;
        console.error('Share failed, attempting fallback...', shareErr);
      }
    }
    
    // Fallback logic for Desktop Desktop / non-supporting browsers
    const dataUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataUrl;
    link.click();
    
    // Cleanup
    setTimeout(() => URL.revokeObjectURL(dataUrl), 1000);
  } catch (err) {
    console.error('Failed to export canvas:', err);
    alert('Failed to export canvas. This might be due to security settings.');
  }
}
