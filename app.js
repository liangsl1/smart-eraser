/**
 * Smart Eraser AI - app.js
 * Core application logic: handles UI events, canvas interactions, 
 * local image drawing, drawing history, and inpainting with OpenCV.js.
 */

// Application State
let imgElement = new Image();
let originalFile = null;
let isImageLoaded = false;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let brushSize = 30;
let currentAlgorithm = 'telea'; // 'telea' or 'ns'

// History stacks for Mask Undo/Redo
let maskUndoStack = [];
let maskRedoStack = [];
const MAX_HISTORY = 10;

// Canvas DOM references
const viewCanvas = document.getElementById('view-canvas');
const sourceCanvas = document.getElementById('source-canvas');
const maskCanvas = document.getElementById('mask-canvas');
const tempCanvas = document.getElementById('temp-canvas');

// Slider comparison DOM references
const sliderContainer = document.getElementById('slider-container');
const sliderHandle = document.getElementById('slider-handle');
const sliderOriginalCanvas = document.getElementById('slider-original-canvas');
const sliderResultCanvas = document.getElementById('slider-result-canvas');
const sliderOriginalWrapper = document.getElementById('slider-original-wrapper');

// Control elements
const uploadTrigger = document.getElementById('upload-trigger');
const imageLoader = document.getElementById('image-loader');
const demoBtn = document.getElementById('demo-btn');
const brushSlider = document.getElementById('brush-size');
const brushSizeVal = document.getElementById('brush-size-val');
const brushPreview = document.getElementById('brush-preview');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const clearMaskBtn = document.getElementById('clear-mask-btn');
const eraseBtn = document.getElementById('erase-btn');
const downloadBtn = document.getElementById('download-btn');
const resetBtn = document.getElementById('reset-btn');
const dropZone = document.getElementById('drop-zone');
const dropZoneBtn = document.getElementById('drop-zone-btn');
const editorContainer = document.getElementById('editor-container');
const editorStatus = document.getElementById('editor-status');
const compareToggleContainer = document.getElementById('compare-toggle-container');
const btnToggleCompare = document.getElementById('btn-toggle-compare');
const algoDescText = document.getElementById('algo-desc-text');

// ----------------------------------------------------
// 1. OpenCV.js Initialization & Loading
// ----------------------------------------------------
function initOpenCV() {
    const loadingBackdrop = document.getElementById('loading-backdrop');
    const loadingProgress = document.getElementById('loading-progress');
    const loadingStatus = document.getElementById('loading-status');

    let progress = 0;
    // Simulate loading progress bar to reassure user
    const progressInterval = setInterval(() => {
        if (progress < 85) {
            progress += Math.floor(Math.random() * 8) + 1;
            loadingProgress.style.width = `${progress}%`;
        }
    }, 150);

    function onReady() {
        clearInterval(progressInterval);
        loadingProgress.style.width = '100%';
        loadingStatus.textContent = '影像引擎載入成功！';
        
        setTimeout(() => {
            loadingBackdrop.classList.add('hidden');
        }, 500);
    }

    // Poll to check when OpenCV object and Mat are fully loaded
    const checkTimer = setInterval(() => {
        if (typeof cv !== 'undefined' && cv.Mat && cv.inpaint) {
            clearInterval(checkTimer);
            onReady();
        }
    }, 100);
}

// ----------------------------------------------------
// 2. Demo Scene Generation (Sunset Beach)
// ----------------------------------------------------
function drawDemoScene() {
    const ctx = sourceCanvas.getContext('2d');
    const w = 800;
    const h = 500;
    sourceCanvas.width = w;
    sourceCanvas.height = h;

    // A. Sky Gradient (Indigo to vibrant red-orange sunset)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.65);
    skyGrad.addColorStop(0, '#1e1b4b'); // deep indigo
    skyGrad.addColorStop(0.3, '#311054'); // dark purple
    skyGrad.addColorStop(0.65, '#b91c1c'); // red-orange
    skyGrad.addColorStop(0.85, '#f97316'); // orange
    skyGrad.addColorStop(1, '#fde047'); // yellow-orange
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h * 0.65);

    // B. Glowing Sun
    ctx.beginPath();
    const sunGrad = ctx.createRadialGradient(w * 0.5, h * 0.55, 2, w * 0.5, h * 0.55, 55);
    sunGrad.addColorStop(0, '#ffffff');
    sunGrad.addColorStop(0.2, '#fef08a');
    sunGrad.addColorStop(0.5, '#f97316');
    sunGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
    ctx.fillStyle = sunGrad;
    ctx.arc(w * 0.5, h * 0.55, 55, 0, Math.PI * 2);
    ctx.fill();

    // C. Ocean (Deep blue-slate with wave highlights reflecting sun)
    const seaGrad = ctx.createLinearGradient(0, h * 0.65, 0, h * 0.85);
    seaGrad.addColorStop(0, '#1e293b');
    seaGrad.addColorStop(1, '#0b0f19');
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, h * 0.65, w, h * 0.2);

    // Sun reflection waves on sea surface
    ctx.fillStyle = 'rgba(254, 240, 138, 0.25)';
    for (let y = h * 0.66; y < h * 0.84; y += 4) {
        let span = (y - h * 0.65) * 5;
        let rx = w * 0.5 - span * 0.5 + Math.sin(y * 1.5) * 8;
        ctx.fillRect(rx, y, span, 1.5);
    }

    // D. Sandy Beach Shore
    ctx.beginPath();
    ctx.moveTo(0, h * 0.8);
    ctx.quadraticCurveTo(w * 0.35, h * 0.77, w, h * 0.87);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const sandGrad = ctx.createLinearGradient(0, h * 0.77, 0, h);
    sandGrad.addColorStop(0, '#78350f'); // dark amber sand
    sandGrad.addColorStop(1, '#451a03'); // deep brown wet sand
    ctx.fillStyle = sandGrad;
    ctx.fill();

    // E. Unwanted elements (Tourists silhouettes standing/walking on beach)
    ctx.fillStyle = '#030712'; // Silhouettes: almost pitch black
    
    // Tourist 1 (Middle-left, walking)
    const px1 = w * 0.3;
    const py1 = h * 0.82;
    // Head
    ctx.beginPath();
    ctx.arc(px1, py1 - 25, 5, 0, Math.PI * 2);
    ctx.fill();
    // Body / Torso
    ctx.beginPath();
    ctx.moveTo(px1 - 3, py1 - 20);
    ctx.lineTo(px1 + 3, py1 - 20);
    ctx.lineTo(px1 + 4, py1 - 8);
    ctx.lineTo(px1 - 4, py1 - 8);
    ctx.closePath();
    ctx.fill();
    // Legs
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#030712';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px1 - 2, py1 - 8);
    ctx.lineTo(px1 - 5, py1 + 2); // left leg forward
    ctx.moveTo(px1 + 2, py1 - 8);
    ctx.lineTo(px1 + 1, py1 + 2); // right leg back
    ctx.stroke();

    // Tourist 2 (Closer-right, standing)
    const px2 = w * 0.65;
    const py2 = h * 0.85;
    // Head
    ctx.beginPath();
    ctx.arc(px2, py2 - 32, 6, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.beginPath();
    ctx.moveTo(px2 - 4, py2 - 26);
    ctx.lineTo(px2 + 4, py2 - 26);
    ctx.lineTo(px2 + 5, py2 - 10);
    ctx.lineTo(px2 - 5, py2 - 10);
    ctx.closePath();
    ctx.fill();
    // Backpack
    ctx.fillStyle = '#111827';
    ctx.fillRect(px2 - 7, py2 - 24, 4, 12);
    // Legs
    ctx.fillStyle = '#030712';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px2 - 2, py2 - 10);
    ctx.lineTo(px2 - 2, py2 + 4);
    ctx.moveTo(px2 + 2, py2 - 10);
    ctx.lineTo(px2 + 2, py2 + 4);
    ctx.stroke();

    // 6. Convert canvas content to Image Element
    imgElement.src = sourceCanvas.toDataURL();
    imgElement.onload = function() {
        setupImageEditor(imgElement);
    };
}

// ----------------------------------------------------
// 3. Image Loading and Editor Setup
// ----------------------------------------------------
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    originalFile = file;

    const reader = new FileReader();
    reader.onload = function(event) {
        imgElement = new Image();
        imgElement.src = event.target.value || event.target.result;
        imgElement.onload = function() {
            setupImageEditor(imgElement);
        };
    };
    reader.readAsDataURL(file);
}

function setupImageEditor(img) {
    isImageLoaded = true;

    // Set canvas dimensions
    const maxViewportWidth = Math.min(window.innerWidth * 0.6, 900);
    const scale = Math.min(1, maxViewportWidth / img.naturalWidth);
    
    const displayWidth = img.naturalWidth * scale;
    const displayHeight = img.naturalHeight * scale;

    // Set source canvas to full image resolution
    sourceCanvas.width = img.naturalWidth;
    sourceCanvas.height = img.naturalHeight;
    const sCtx = sourceCanvas.getContext('2d');
    sCtx.drawImage(img, 0, 0);

    // Set main interactive view canvas
    viewCanvas.width = displayWidth;
    viewCanvas.height = displayHeight;
    const vCtx = viewCanvas.getContext('2d');
    vCtx.drawImage(img, 0, 0, displayWidth, displayHeight);

    // Set mask canvas (Must be exactly same dimensions as full resolution image)
    maskCanvas.width = img.naturalWidth;
    maskCanvas.height = img.naturalHeight;
    clearMask();

    // Reset history stacks
    maskUndoStack = [];
    maskRedoStack = [];
    updateHistoryButtons();

    // Toggle UI States
    dropZone.style.display = 'none';
    editorContainer.style.display = 'flex';
    sliderContainer.style.display = 'none';
    compareToggleContainer.style.display = 'none';
    
    document.querySelectorAll('.disabled-when-no-img').forEach(el => {
        el.classList.add('active');
    });

    eraseBtn.classList.remove('ready');
    updateStatus('準備就緒：請在要刪除的人物或物件上進行塗抹');
}

function clearMask() {
    const mCtx = maskCanvas.getContext('2d');
    mCtx.fillStyle = '#000000'; // Black background = unmasked
    mCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
}

function updateStatus(text, isProcessing = false) {
    editorStatus.textContent = text;
    const dot = document.querySelector('.pulse-dot');
    if (isProcessing) {
        dot.classList.add('processing');
    } else {
        dot.classList.remove('processing');
    }
}

// ----------------------------------------------------
// 4. Drawing and Masking Interaction
// ----------------------------------------------------
function getCoordinates(e) {
    const rect = viewCanvas.getBoundingClientRect();
    let x, y;
    if (e.touches && e.touches[0]) {
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
    } else {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
    }
    // Scale coordinate based on canvas CSS display vs backing store resolution
    return {
        viewX: x,
        viewY: y,
        sourceX: x * (sourceCanvas.width / viewCanvas.width),
        sourceY: y * (sourceCanvas.height / viewCanvas.height)
    };
}

function startDrawing(e) {
    if (!isImageLoaded) return;
    
    // Hide comparison slider if drawing again
    if (sliderContainer.style.display !== 'none') {
        sliderContainer.style.display = 'none';
        compareToggleContainer.style.display = 'none';
        redrawViewCanvas();
    }

    isDrawing = true;
    const coords = getCoordinates(e);
    lastX = coords.viewX;
    lastY = coords.viewY;

    // Push current mask state to undo stack before starting stroke
    saveMaskHistory();

    drawStroke(e);
}

function drawStroke(e) {
    if (!isDrawing) return;
    e.preventDefault();

    const coords = getCoordinates(e);
    const scaleFactor = sourceCanvas.width / viewCanvas.width;
    
    // 1. Draw red transparent overlay stroke on interactive view canvas
    const vCtx = viewCanvas.getContext('2d');
    vCtx.strokeStyle = 'rgba(239, 68, 68, 0.55)'; // transparent red
    vCtx.lineWidth = brushSize;
    vCtx.lineCap = 'round';
    vCtx.lineJoin = 'round';
    
    vCtx.beginPath();
    vCtx.moveTo(lastX, lastY);
    vCtx.lineTo(coords.viewX, coords.viewY);
    vCtx.stroke();

    // 2. Draw white solid stroke on the black-and-white mask canvas (used for inpainting)
    const mCtx = maskCanvas.getContext('2d');
    mCtx.strokeStyle = '#ffffff'; // solid white = mask
    mCtx.lineWidth = brushSize * scaleFactor; // scale brush to original resolution
    mCtx.lineCap = 'round';
    mCtx.lineJoin = 'round';
    
    mCtx.beginPath();
    mCtx.moveTo(lastX * scaleFactor, lastY * scaleFactor);
    mCtx.lineTo(coords.sourceX, coords.sourceY);
    mCtx.stroke();

    lastX = coords.viewX;
    lastY = coords.viewY;

    eraseBtn.classList.add('ready');
}

function stopDrawing() {
    isDrawing = false;
}

// Redraw the view canvas combining original source image and current mask
function redrawViewCanvas() {
    const vCtx = viewCanvas.getContext('2d');
    vCtx.clearRect(0, 0, viewCanvas.width, viewCanvas.height);
    
    // Draw original image
    vCtx.drawImage(sourceCanvas, 0, 0, viewCanvas.width, viewCanvas.height);
    
    // Draw mask on top as transparent red
    tempCanvas.width = viewCanvas.width;
    tempCanvas.height = viewCanvas.height;
    const tCtx = tempCanvas.getContext('2d');
    tCtx.drawImage(maskCanvas, 0, 0, viewCanvas.width, viewCanvas.height);
    
    // Apply red color overlay
    tCtx.globalCompositeOperation = 'source-in';
    tCtx.fillStyle = 'rgba(239, 68, 68, 0.55)';
    tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Blend it back
    vCtx.drawImage(tempCanvas, 0, 0);
}

// ----------------------------------------------------
// 5. History / Undo / Redo Mechanism
// ----------------------------------------------------
function saveMaskHistory() {
    const mCtx = maskCanvas.getContext('2d');
    const maskData = mCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    maskUndoStack.push(maskData);
    
    if (maskUndoStack.length > MAX_HISTORY) {
        maskUndoStack.shift();
    }
    
    // Clear redo stack on new action
    maskRedoStack = [];
    updateHistoryButtons();
}

function undo() {
    if (maskUndoStack.length === 0) return;
    
    const mCtx = maskCanvas.getContext('2d');
    const currentMask = mCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    maskRedoStack.push(currentMask);
    
    const previousMask = maskUndoStack.pop();
    mCtx.putImageData(previousMask, 0, 0);
    
    redrawViewCanvas();
    updateHistoryButtons();
    checkIfMaskIsEmpty();
}

function redo() {
    if (maskRedoStack.length === 0) return;
    
    const mCtx = maskCanvas.getContext('2d');
    const currentMask = mCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    maskUndoStack.push(currentMask);
    
    const nextMask = maskRedoStack.pop();
    mCtx.putImageData(nextMask, 0, 0);
    
    redrawViewCanvas();
    updateHistoryButtons();
    eraseBtn.classList.add('ready');
}

function updateHistoryButtons() {
    undoBtn.disabled = maskUndoStack.length === 0;
    redoBtn.disabled = maskRedoStack.length === 0;
}

function checkIfMaskIsEmpty() {
    const mCtx = maskCanvas.getContext('2d');
    const data = mCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
    let hasWhite = false;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 128) {
            hasWhite = true;
            break;
        }
    }
    if (!hasWhite) {
        eraseBtn.classList.remove('ready');
    }
}

// ----------------------------------------------------
// 6. AI Inpainting Engine (OpenCV.js execution)
// ----------------------------------------------------
async function performInpainting() {
    if (!isImageLoaded) return;
    
    // Check if mask is empty
    const mCtx = maskCanvas.getContext('2d');
    const data = mCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
    let hasMask = false;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 128) {
            hasMask = true;
            break;
        }
    }

    if (!hasMask) {
        alert('請先在畫面上塗抹欲抹除的人物或區域！');
        return;
    }

    updateStatus('AI 抹除計算中，請稍候...', true);
    eraseBtn.disabled = true;

    // Use setTimeout to allow the UI thread to update status before heavy computation
    setTimeout(() => {
        try {
            // A. Create source Mat (from sourceCanvas, full resolution)
            const src = cv.imread(sourceCanvas);

            // B. Create mask Mat
            const mask = cv.imread(maskCanvas);
            const grayMask = new cv.Mat();
            cv.cvtColor(mask, grayMask, cv.COLOR_RGBA2GRAY);

            // C. Create destination Mat
            const dst = new cv.Mat();

            // D. Select algorithm inpaint method flag
            const flag = currentAlgorithm === 'ns' ? cv.INPAINT_NS : cv.INPAINT_TELEA;

            // E. Perform inpainting (radius set to 5 for general object removal)
            cv.inpaint(src, grayMask, dst, 5, flag);

            // F. Display inpainted result back to canvases
            cv.imshow(sourceCanvas, dst); // update full resolution source
            
            // Render to view canvas
            const vCtx = viewCanvas.getContext('2d');
            vCtx.clearRect(0, 0, viewCanvas.width, viewCanvas.height);
            vCtx.drawImage(sourceCanvas, 0, 0, viewCanvas.width, viewCanvas.height);

            // G. Setup Before/After Slider Comparison
            setupSliderComparison();

            // H. Clean up OpenCV Mat memory
            src.delete();
            mask.delete();
            grayMask.delete();
            dst.delete();

            // Clear mask canvas to prevent double processing
            clearMask();
            
            // Enable buttons
            eraseBtn.disabled = false;
            eraseBtn.classList.remove('ready');
            updateStatus('AI 抹除完成！');
        } catch (err) {
            console.error('OpenCV inpainting error: ', err);
            updateStatus('抹除處理失敗，請重試。');
            eraseBtn.disabled = false;
        }
    }, 50);
}

// ----------------------------------------------------
// 7. Before / After Comparison Slider
// ----------------------------------------------------
function setupSliderComparison() {
    // Fill result canvas with inpainted image
    sliderResultCanvas.width = viewCanvas.width;
    sliderResultCanvas.height = viewCanvas.height;
    const rCtx = sliderResultCanvas.getContext('2d');
    rCtx.drawImage(sourceCanvas, 0, 0, viewCanvas.width, viewCanvas.height);

    // Fill original canvas with original loaded image data
    sliderOriginalCanvas.width = viewCanvas.width;
    sliderOriginalCanvas.height = viewCanvas.height;
    const oCtx = sliderOriginalCanvas.getContext('2d');
    
    // Draw original image based on original image element
    oCtx.drawImage(imgElement, 0, 0, viewCanvas.width, viewCanvas.height);

    // Align canvas sizing in CSS
    const widthStyle = `${viewCanvas.width}px`;
    const heightStyle = `${viewCanvas.height}px`;
    
    sliderOriginalCanvas.style.width = widthStyle;
    sliderOriginalCanvas.style.height = heightStyle;
    sliderResultCanvas.style.width = widthStyle;
    sliderResultCanvas.style.height = heightStyle;
    
    // Reset slider default position to 50%
    sliderContainer.style.setProperty('--slider-pos', '50%');
    sliderOriginalWrapper.style.width = '50%';
    
    // Show slider container
    sliderContainer.style.display = 'block';
    compareToggleContainer.style.display = 'block';

    initSliderDrag();
}

function initSliderDrag() {
    let isDraggingSlider = false;

    function moveSlider(e) {
        if (!isDraggingSlider) return;
        
        const containerRect = sliderContainer.getBoundingClientRect();
        let clientX = e.clientX;
        if (e.touches && e.touches[0]) {
            clientX = e.touches[0].clientX;
        }
        
        let position = clientX - containerRect.left;
        let percentage = (position / containerRect.width) * 100;
        
        // Boundaries constraint (0% - 100%)
        percentage = Math.max(0, Math.min(100, percentage));
        
        // Update styling
        sliderContainer.style.setProperty('--slider-pos', `${percentage}%`);
        sliderOriginalWrapper.style.width = `${percentage}%`;
    }

    // Event listeners for desktop mouse
    sliderHandle.addEventListener('mousedown', () => isDraggingSlider = true);
    window.addEventListener('mouseup', () => isDraggingSlider = false);
    window.addEventListener('mousemove', moveSlider);

    // Event listeners for mobile touch
    sliderHandle.addEventListener('touchstart', () => isDraggingSlider = true);
    window.addEventListener('touchend', () => isDraggingSlider = false);
    window.addEventListener('touchmove', moveSlider);
}

// ----------------------------------------------------
// 8. Event Handlers & Helper Functions
// ----------------------------------------------------
function updateBrushSize(size) {
    brushSize = parseInt(size);
    brushSizeVal.textContent = `${brushSize}px`;
    
    // Update visual preview dot
    brushPreview.style.width = `${brushSize}px`;
    brushPreview.style.height = `${brushSize}px`;
}

function handleAlgorithmChange(e) {
    currentAlgorithm = e.target.value;
    if (currentAlgorithm === 'telea') {
        algoDescText.textContent = 'Telea 演算法：基於快速行進法 (FMM)，從邊緣逐步向內插值，最適合去除線狀、細長人物或中小型污點。';
    } else {
        algoDescText.textContent = 'Navier-Stokes 演算法：基於流體力學偏微分方程，藉由傳播影像亮度和連續性進行修復，對於較大的人物或紋理平滑區域有更好的過渡效果。';
    }
}

function resetImage() {
    if (!isImageLoaded) return;
    if (confirm('確定要還原到照片最初載入的狀態嗎？')) {
        setupImageEditor(imgElement);
    }
}

function downloadImage() {
    if (!isImageLoaded) return;
    
    // Temporary canvas to export in case slider comparison is visible
    const outCanvas = document.createElement('canvas');
    outCanvas.width = sourceCanvas.width;
    outCanvas.height = sourceCanvas.height;
    const ctx = outCanvas.getContext('2d');
    ctx.drawImage(sourceCanvas, 0, 0);

    const dataUrl = outCanvas.toDataURL('image/jpeg', 0.95);
    const link = document.createElement('a');
    
    // Name file smartly based on original name
    let filename = 'smart-eraser-result.jpg';
    if (originalFile && originalFile.name) {
        const parts = originalFile.name.split('.');
        parts.pop();
        filename = `${parts.join('.')}-erased.jpg`;
    }
    
    link.download = filename;
    link.href = dataUrl;
    link.click();
}

// Hold to see original image logic
function bindCompareToggleEvents() {
    function showOriginal() {
        if (sliderContainer.style.display !== 'none') {
            sliderOriginalWrapper.style.width = '100%';
            sliderContainer.style.setProperty('--slider-pos', '100%');
        }
    }
    
    function showSplit() {
        if (sliderContainer.style.display !== 'none') {
            sliderOriginalWrapper.style.width = '50%';
            sliderContainer.style.setProperty('--slider-pos', '50%');
        }
    }

    // Mouse press/release
    btnToggleCompare.addEventListener('mousedown', showOriginal);
    btnToggleCompare.addEventListener('mouseup', showSplit);
    btnToggleCompare.addEventListener('mouseleave', showSplit);

    // Mobile touch press/release
    btnToggleCompare.addEventListener('touchstart', (e) => {
        e.preventDefault();
        showOriginal();
    });
    btnToggleCompare.addEventListener('touchend', showSplit);
}

// ----------------------------------------------------
// 9. UI Binding and Event Listeners
// ----------------------------------------------------
function bindUIEvents() {
    // File inputs trigger
    uploadTrigger.addEventListener('click', () => imageLoader.click());
    imageLoader.addEventListener('change', handleImageUpload);
    
    // Dropzone logic
    dropZone.addEventListener('click', () => imageLoader.click());
    dropZoneBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent double click trigger
        imageLoader.click();
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            originalFile = e.dataTransfer.files[0];
            const reader = new FileReader();
            reader.onload = function(event) {
                imgElement = new Image();
                imgElement.src = event.target.value || event.target.result;
                imgElement.onload = function() {
                    setupImageEditor(imgElement);
                };
            };
            reader.readAsDataURL(originalFile);
        }
    });

    // Demo scene trigger
    demoBtn.addEventListener('click', drawDemoScene);

    // Brush slider trigger
    brushSlider.addEventListener('input', (e) => updateBrushSize(e.target.value));

    // Painting handlers on viewCanvas (mouse and touch)
    viewCanvas.addEventListener('mousedown', startDrawing);
    window.addEventListener('mouseup', stopDrawing);
    viewCanvas.addEventListener('mousemove', drawStroke);
    viewCanvas.addEventListener('mouseleave', stopDrawing);

    viewCanvas.addEventListener('touchstart', startDrawing);
    window.addEventListener('touchend', stopDrawing);
    viewCanvas.addEventListener('touchmove', drawStroke);

    // Action buttons trigger
    eraseBtn.addEventListener('click', performInpainting);
    clearMaskBtn.addEventListener('click', () => {
        clearMask();
        redrawViewCanvas();
        eraseBtn.classList.remove('ready');
    });
    
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    resetBtn.addEventListener('click', resetImage);
    downloadBtn.addEventListener('click', downloadImage);

    // Algorithm switcher radio buttons
    document.querySelectorAll('input[name="algorithm"]').forEach(radio => {
        radio.addEventListener('change', handleAlgorithmChange);
    });

    // Dynamic resize responsiveness
    window.addEventListener('resize', () => {
        if (isImageLoaded) {
            setupImageEditor(imgElement);
        }
    });

    bindCompareToggleEvents();
    
    // Initial brush size preview alignment
    updateBrushSize(brushSlider.value);
}

// Document Load entry
document.addEventListener('DOMContentLoaded', () => {
    bindUIEvents();
    initOpenCV();
});
