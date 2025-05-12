// Global variables
let videoSource = document.getElementById('video-source');
let canvas = document.getElementById('preview-canvas');
let ctx = canvas.getContext('2d');
let timeline = document.getElementById('timeline');
let playhead = document.getElementById('playhead');
let currentTime = 0;
let duration = 0;
let isPlaying = false;
let videoFile = null;
let currentClip = null;
let clips = [];

// Initialize FFmpeg
const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: true });

// Initialize the application
async function init() {
    try {
        await ffmpeg.load();
        console.log('FFmpeg loaded successfully');
    } catch (error) {
        console.error('Error loading FFmpeg:', error);
        alert('Failed to load FFmpeg. Please try again or check your browser compatibility.');
    }

    setupEventListeners();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}

// Set up event listeners
function setupEventListeners() {
    // Video file upload
    document.getElementById('videoFile').addEventListener('change', handleVideoUpload);
    
    // Playback controls
    document.getElementById('playBtn').addEventListener('click', playVideo);
    document.getElementById('pauseBtn').addEventListener('click', pauseVideo);
    
    // Editing tools
    document.getElementById('trimBtn').addEventListener('click', showTrimControls);
    document.getElementById('cropBtn').addEventListener('click', showCropControls);
    document.getElementById('filterBtn').addEventListener('click', showFilterControls);
    
    // Export video
    document.getElementById('exportBtn').addEventListener('click', exportVideo);
}

// Handle video file upload
function handleVideoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    videoFile = file;
    const videoURL = URL.createObjectURL(file);
    videoSource.src = videoURL;
    
    videoSource.onloadedmetadata = function() {
        duration = videoSource.duration;
        canvas.width = videoSource.videoWidth;
        canvas.height = videoSource.videoHeight;
        resizeCanvas();
        
        // Create initial clip that represents the entire video
        createVideoClip(0, duration);
        
        // Start drawing the first frame
        drawCurrentFrame();
    };
    
    videoSource.load();
}

// Create a video clip element in the timeline
function createVideoClip(start, end) {
    const clip = {
        id: 'clip-' + Date.now(),
        start: start,
        end: end,
        startPercentage: (start / duration) * 100,
        endPercentage: (end / duration) * 100,
        filters: []
    };
    
    clips.push(clip);
    renderTimeline();
    
    // Set as current clip
    currentClip = clip;
}

// Render the timeline with all clips
function renderTimeline() {
    timeline.innerHTML = '';
    
    clips.forEach(clip => {
        const clipElement = document.createElement('div');
        clipElement.className = 'video-clip';
        clipElement.id = clip.id;
        clipElement.style.left = clip.startPercentage + '%';
        clipElement.style.width = (clip.endPercentage - clip.startPercentage) + '%';
        
        // Add handles for trimming
        const leftHandle = document.createElement('div');
        leftHandle.className = 'clip-handle left';
        
        const rightHandle = document.createElement('div');
        rightHandle.className = 'clip-handle right';
        
        clipElement.appendChild(leftHandle);
        clipElement.appendChild(rightHandle);
        
        // Make clip draggable
        makeClipDraggable(clipElement, clip);
        
        // Make handles resizable
        makeHandleResizable(leftHandle, rightHandle, clipElement, clip);
        
        timeline.appendChild(clipElement);
    });
}

// Make clip draggable
function makeClipDraggable(element, clip) {
    let isDragging = false;
    let startX, startLeft;
    
    element.addEventListener('mousedown', (e) => {
        if (!e.target.classList.contains('clip-handle')) {
            isDragging = true;
            startX = e.clientX;
            startLeft = parseFloat(element.style.left);
            
            // Set current clip
            currentClip = clip;
        }
    });
    
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const deltaX = e.clientX - startX;
            const timelineWidth = timeline.offsetWidth;
            
            // Calculate new position as percentage
            let newLeft = startLeft + (deltaX / timelineWidth * 100);
            
            // Constrain within timeline
            newLeft = Math.max(0, Math.min(100 - (clip.endPercentage - clip.startPercentage), newLeft));
            
            element.style.left = newLeft + '%';
            
            // Update clip data
            const newStartTime = (newLeft / 100) * duration;
            const newEndTime = newStartTime + (clip.end - clip.start);
            
            clip.start = newStartTime;
            clip.end = newEndTime;
            clip.startPercentage = newLeft;
            clip.endPercentage = newLeft + (clip.endPercentage - clip.startPercentage);
            
            // Update current time to reflect the new position
            currentTime = newStartTime;
            updatePlayhead();
            drawCurrentFrame();
        }
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

// Make handles resizable for trimming
function makeHandleResizable(leftHandle, rightHandle, clipElement, clip) {
    let isResizing = false;
    let startX, startWidth, startLeft;
    let isLeftHandle = false;
    
    // Left handle (trim start)
    leftHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        isLeftHandle = true;
        startX = e.clientX;
        startLeft = parseFloat(clipElement.style.left);
        startWidth = parseFloat(clipElement.style.width);
        e.stopPropagation();
    });
    
    // Right handle (trim end)
    rightHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        isLeftHandle = false;
        startX = e.clientX;
        startWidth = parseFloat(clipElement.style.width);
        e.stopPropagation();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (isResizing) {
            const deltaX = e.clientX - startX;
            const timelineWidth = timeline.offsetWidth;
            const deltaPercentage = (deltaX / timelineWidth) * 100;
            
            if (isLeftHandle) {
                // Resize from left
                let newLeft = Math.max(0, startLeft + deltaPercentage);
                let newWidth = startWidth - (newLeft - startLeft);
                
                // Ensure minimum width
                if (newWidth < 5) {
                    newWidth = 5;
                    newLeft = startLeft + startWidth - newWidth;
                }
                
                clipElement.style.left = newLeft + '%';
                clipElement.style.width = newWidth + '%';
                
                // Update clip data
                clip.start = (newLeft / 100) * duration;
                clip.startPercentage = newLeft;
                
                // Update current time to reflect the new position
                currentTime = clip.start;
            } else {
                // Resize from right
                let newWidth = Math.max(5, startWidth + deltaPercentage);
                
                // Ensure doesn't exceed timeline
                if (startLeft + newWidth > 100) {
                    newWidth = 100 - startLeft;
                }
                
                clipElement.style.width = newWidth + '%';
                
                // Update clip data
                clip.end = clip.start + (newWidth / 100) * duration;
                clip.endPercentage = clip.startPercentage + newWidth;
                
                // Update current time to see the trim point
                currentTime = clip.end;
            }
            
            updatePlayhead();
            drawCurrentFrame();
        }
    });
    
    document.addEventListener('mouseup', () => {
        isResizing = false;
    });
}

// Play the video preview
function playVideo() {
    if (!videoSource.src) return;
    
    isPlaying = true;
    videoSource.currentTime = currentTime;
    videoSource.play();
    
    // Animation loop for playback
    function updateVideo() {
        if (isPlaying) {
            currentTime = videoSource.currentTime;
            
            // Check if we reached the end of the current clip
            if (currentClip && currentTime >= currentClip.end) {
                pauseVideo();
                currentTime = currentClip.start;
                videoSource.currentTime = currentTime;
            } else {
                drawCurrentFrame();
                updatePlayhead();
                requestAnimationFrame(updateVideo);
            }
        }
    }
    
    updateVideo();
}

// Pause the video preview
function pauseVideo() {
    isPlaying = false;
    videoSource.pause();
}

// Draw the current frame on the canvas
function drawCurrentFrame() {
    if (!videoSource.src) return;
    
    // Update video playback position if needed
    if (Math.abs(videoSource.currentTime - currentTime) > 0.1) {
        videoSource.currentTime = currentTime;
    }
    
    ctx.drawImage(videoSource, 0, 0, canvas.width, canvas.height);
    
    // Apply any active filters to the canvas
    applyFilters();
}

// Update playhead position
function updatePlayhead() {
    if (duration === 0) return;
    
    const position = (currentTime / duration) * 100;
    playhead.style.left = position + '%';
}

// Resize canvas to maintain aspect ratio
function resizeCanvas() {
    if (!videoSource.videoWidth) return;
    
    const containerWidth = canvas.parentElement.offsetWidth;
    const aspectRatio = videoSource.videoWidth / videoSource.videoHeight;
    
    // Set canvas display size (CSS)
    const height = containerWidth / aspectRatio;
    canvas.style.height = height + 'px';
}

// Show trimming controls in properties panel
function showTrimControls() {
    if (!currentClip) return;
    
    const propertiesContent = document.getElementById('properties-content');
    propertiesContent.innerHTML = `
        <div class="mb-3">
            <label for="trimStart" class="form-label">Start Time: <span id="startTimeValue">${currentClip.start.toFixed(2)}</span>s</label>
            <input type="range" class="form-range" id="trimStart" min="0" max="${duration}" step="0.01" value="${currentClip.start}">
        </div>
        <div class="mb-3">
            <label for="trimEnd" class="form-label">End Time: <span id="endTimeValue">${currentClip.end.toFixed(2)}</span>s</label>
            <input type="range" class="form-range" id="trimEnd" min="0" max="${duration}" step="0.01" value="${currentClip.end}">
        </div>
    `;
    
    // Add event listeners for range inputs
    document.getElementById('trimStart').addEventListener('input', (e) => {
        const newStart = parseFloat(e.target.value);
        document.getElementById('startTimeValue').textContent = newStart.toFixed(2);
        
        // Update clip
        currentClip.start = newStart;
        currentClip.startPercentage = (newStart / duration) * 100;
        
        // Update UI
        renderTimeline();
        currentTime = newStart;
        updatePlayhead();
        drawCurrentFrame();
    });
    
    document.getElementById('trimEnd').addEventListener('input', (e) => {
        const newEnd = parseFloat(e.target.value);
        document.getElementById('endTimeValue').textContent = newEnd.toFixed(2);
        
        // Update clip
        currentClip.end = newEnd;
        currentClip.endPercentage = (newEnd / duration) * 100;
        
        // Update UI
        renderTimeline();
        currentTime = newEnd;
        updatePlayhead();
        drawCurrentFrame();
    });
}

// Show cropping controls in properties panel
function showCropControls() {
    const propertiesContent = document.getElementById('properties-content');
    propertiesContent.innerHTML = `
        <div class="mb-3">
            <label for="cropTop" class="form-label">Top: <span id="cropTopValue">0</span>%</label>
            <input type="range" class="form-range" id="cropTop" min="0" max="49" value="0">
        </div>
        <div class="mb-3">
            <label for="cropBottom" class="form-label">Bottom: <span id="cropBottomValue">0</span>%</label>
            <input type="range" class="form-range" id="cropBottom" min="0" max="49" value="0">
        </div>
        <div class="mb-3">
            <label for="cropLeft" class="form-label">Left: <span id="cropLeftValue">0</span>%</label>
            <input type="range" class="form-range" id="cropLeft" min="0" max="49" value="0">
        </div>
        <div class="mb-3">
            <label for="cropRight" class="form-label">Right: <span id="cropRightValue">0</span>%</label>
            <input type="range" class="form-range" id="cropRight" min="0" max="49" value="0">
        </div>
        <button id="applyCropBtn" class="btn btn-primary">Apply Crop</button>
    `;
    
    // Add crop preview functionality
    const cropControls = ['cropTop', 'cropBottom', 'cropLeft', 'cropRight'];
    const cropValues = {
        cropTop: 0,
        cropBottom: 0,
        cropLeft: 0,
        cropRight: 0
    };
    
    cropControls.forEach(control => {
        document.getElementById(control).addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById(`${control}Value`).textContent = value;
            cropValues[control] = value;
            previewCrop();
        });
    });
    
    function previewCrop() {
        drawCurrentFrame();
        
        // Draw crop overlay
        const width = canvas.width;
        const height = canvas.height;
        
        const cropLeft = (cropValues.cropLeft / 100) * width;
        const cropRight = (cropValues.cropRight / 100) * width;
        const cropTop = (cropValues.cropTop / 100) * height;
        const cropBottom = (cropValues.cropBottom / 100) * height;
        
        // Draw semi-transparent overlay for cropped areas
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        
        // Top
        ctx.fillRect(0, 0, width, cropTop);
        
        // Bottom
        ctx.fillRect(0, height - cropBottom, width, cropBottom);
        
        // Left
        ctx.fillRect(0, cropTop, cropLeft, height - cropTop - cropBottom);
        
        // Right
        ctx.fillRect(width - cropRight, cropTop, cropRight, height - cropTop - cropBottom);
    }
    
    // Add apply crop button functionality
    document.getElementById('applyCropBtn').addEventListener('click', () => {
        if (!currentClip) return;
        
        // Add crop filter to current clip
        currentClip.filters.push({
            type: 'crop',
            top: cropValues.cropTop,
            bottom: cropValues.cropBottom,
            left: cropValues.cropLeft,
            right: cropValues.cropRight
        });
        
        drawCurrentFrame();
    });
}

// Show filter controls in properties panel
function showFilterControls() {
    const propertiesContent = document.getElementById('properties-content');
    propertiesContent.innerHTML = `
        <div class="mb-3">
            <label for="brightness" class="form-label">Brightness: <span id="brightnessValue">100</span>%</label>
            <input type="range" class="form-range" id="brightness" min="0" max="200" value="100">
        </div>
        <div class="mb-3">
            <label for="contrast" class="form-label">Contrast: <span id="contrastValue">100</span>%</label>
            <input type="range" class="form-range" id="contrast" min="0" max="200" value="100">
        </div>
        <div class="mb-3">
            <label for="saturation" class="form-label">Saturation: <span id="saturationValue">100</span>%</label>
            <input type="range" class="form-range" id="saturation" min="0" max="200" value="100">
        </div>
        <div class="mb-3">
            <label for="blur" class="form-label">Blur: <span id="blurValue">0</span>px</label>
            <input type="range" class="form-range" id="blur" min="0" max="10" step="0.1" value="0">
        </div>
        <div class="mb-3">
            <label class="form-label">Presets</label>
            <div class="btn-group w-100">
                <button id="grayScaleBtn" class="btn btn-secondary btn-sm">Grayscale</button>
                <button id="sepiaBtn" class="btn btn-secondary btn-sm">Sepia</button>
                <button id="invertBtn" class="btn btn-secondary btn-sm">Invert</button>
            </div>
        </div>
        <button id="applyFilterBtn" class="btn btn-primary">Apply Filter</button>
    `;
    
    // Add filter preview functionality
    const filterControls = ['brightness', 'contrast', 'saturation', 'blur'];
    const filterValues = {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        blur: 0,
        grayscale: 0,
        sepia: 0,
        invert: 0
    };
    
    filterControls.forEach(control => {
        document.getElementById(control).addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            document.getElementById(`${control}Value`).textContent = value;
            filterValues[control] = value;
            previewFilter();
        });
    });
    
    // Preset buttons
    document.getElementById('grayScaleBtn').addEventListener('click', () => {
        filterValues.grayscale = filterValues.grayscale ? 0 : 100;
        previewFilter();
    });
    
    document.getElementById('sepiaBtn').addEventListener('click', () => {
        filterValues.sepia = filterValues.sepia ? 0 : 100;
        previewFilter();
    });
    
    document.getElementById('invertBtn').addEventListener('click', () => {
        filterValues.invert = filterValues.invert ? 0 : 100;
        previewFilter();
    });
    
    function previewFilter() {
        drawCurrentFrame();
        
        // Apply CSS filters to canvas
        const filterString = `brightness(${filterValues.brightness}%) contrast(${filterValues.contrast}%) saturate(${filterValues.saturation}%) blur(${filterValues.blur}px) grayscale(${filterValues.grayscale}%) sepia(${filterValues.sepia}%) invert(${filterValues.invert}%)`;
        canvas.style.filter = filterString;
    }
    
    // Add apply filter button functionality
    document.getElementById('applyFilterBtn').addEventListener('click', () => {
        if (!currentClip) return;
        
        // Add filter to current clip
        currentClip.filters.push({
            type: 'cssFilter',
            values: { ...filterValues }
        });
        
        // Reset canvas filter style
        canvas.style.filter = '';
        
        // Apply all filters
        drawCurrentFrame();
    });
}

// Apply all filters for the current clip
function applyFilters() {
    if (!currentClip || !currentClip.filters.length) return;
    
    // Apply each filter in sequence
    currentClip.filters.forEach(filter => {
        if (filter.type === 'crop') {
            applyCropFilter(filter);
        } else if (filter.type === 'cssFilter') {
            applyCssFilter(filter);
        }
    });
}

// Apply crop filter to canvas
function applyCropFilter(filter) {
    const width = canvas.width;
    const height = canvas.height;
    
    const cropLeft = (filter.left / 100) * width;
    const cropRight = (filter.right / 100) * width;
    const cropTop = (filter.top / 100) * height;
    const cropBottom = (filter.bottom / 100) * height;
    
    const newWidth = width - cropLeft - cropRight;
    const newHeight = height - cropTop - cropBottom;
    
    // Get the cropped image data
    const imageData = ctx.getImageData(cropLeft, cropTop, newWidth, newHeight);
    
    // Clear canvas and draw cropped image
    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(imageData, 0, 0);
}

// Apply CSS filters to canvas
function applyCssFilter(filter) {
    const { brightness, contrast, saturation, blur, grayscale, sepia, invert } = filter.values;
    
    // Get image data from canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Apply filters manually (this is a simplified version)
    for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        
        // Apply brightness
        const brightnessFactor = brightness / 100;
        r *= brightnessFactor;
        g *= brightnessFactor;
        b *= brightnessFactor;
        
        // Apply contrast
        const contrastFactor = (contrast / 100) - 0.5;
        r = (r - 128) * (1 + contrastFactor) + 128;
        g = (g - 128) * (1 + contrastFactor) + 128;
        b = (b - 128) * (1 + contrastFactor) + 128;
        
        // Apply grayscale
        if (grayscale > 0) {
            const gray = 0.3 * r + 0.59 * g + 0.11 * b;
            const grayAmount = grayscale / 100;
            r = r * (1 - grayAmount) + gray * grayAmount;
            g = g * (1 - grayAmount) + gray * grayAmount;
            b = b * (1 - grayAmount) + gray * grayAmount;
        }
        
        // Apply sepia
        if (sepia > 0) {
            const sepiaAmount = sepia / 100;
            const sepiaR = (r * 0.393) + (g * 0.769) + (b * 0.189);
            const sepiaG = (r * 0.349) + (g * 0.686) + (b * 0.168);
            const sepiaB = (r * 0.272) + (g * 0.534) + (b * 0.131);
            
            r = r * (1 - sepiaAmount) + sepiaR * sepiaAmount;
            g = g * (1 - sepiaAmount) + sepiaG * sepiaAmount;
            b = b * (1 - sepiaAmount) + sepiaB * sepiaAmount;
        }
        
        // Apply invert
        if (invert > 0) {
            const invertAmount = invert / 100;
            r = r * (1 - invertAmount) + (255 - r) * invertAmount;
            g = g * (1 - invertAmount) + (255 - g) * invertAmount;
            b = b * (1 - invertAmount) + (255 - b) * invertAmount;
        }
        
        // Clamp values
        data[i] = Math.max(0, Math.min(255, Math.round(r)));
        data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
        data[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    }
    
    // Put modified image data back to canvas
    ctx.putImageData(imageData, 0, 0);
}

// Export the edited video
async function exportVideo() {
    if (!clips.length || !videoFile) {
        alert('No video to export');
        return;
    }
    
    const exportButton = document.getElementById('exportBtn');
    exportButton.disabled = true;
    exportButton.textContent = 'Processing...';
    
    try {
        // Ensure FFmpeg is loaded
        if (!ffmpeg.isLoaded()) {
            await ffmpeg.load();
        }
        
        // Write the input file to FFmpeg's virtual file system
        ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(videoFile));
        
        // Get export format
        const format = document.getElementById('exportFormat').value;
        
        // Process each clip
        let outputFiles = [];
        
        for (let i = 0; i < clips.length; i++) {
            const clip = clips[i];
            
            // Apply trim
            await ffmpeg.run(
                '-i', 'input.mp4',
                '-ss', clip.start.toString(),
                '-to', clip.end.toString(),
                '-c:v', 'libx264',
                '-c:a', 'aac',
                `temp_${i}.mp4`
            );
            
            outputFiles.push(`temp_${i}.mp4`);
        }
        
        // Concatenate clips if there are multiple
        if (outputFiles.length > 1) {
            // Create concat file
            let concatContent = '';
            outputFiles.forEach(file => {
                concatContent += `file ${file}\n`;
            });
            
            ffmpeg.FS('writeFile', 'concat_list.txt', concatContent);
            
            await ffmpeg.run(
                '-f', 'concat',
                '-safe', '0',
                '-i', 'concat_list.txt',
                '-c', 'copy',
                'output.mp4'
            );
        } else {
            // Just rename the single output file
            ffmpeg.FS('rename', outputFiles[0], 'output.mp4');
        }
        
        // Convert to the desired format if not mp4
        if (format !== 'mp4') {
            await ffmpeg.run(
                '-i', 'output.mp4',
                format === 'gif' ? '-filter_complex' : '-c:v',
                format === 'gif' ? 'fps=15,scale=320:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse' : 'libvpx-vp9',
                format === 'gif' ? 'output.gif' : 'output.webm'
            );
        }
        
        // Read the output file
        const outputFileName = `output.${format}`;
        const data = ffmpeg.FS('readFile', outputFileName);
        
        // Create a download link
        const blob = new Blob([data.buffer], { type: format === 'mp4' ? 'video/mp4' : (format === 'webm' ? 'video/webm' : 'image/gif') });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edited_video.${format}`;
        a.click();
        
        // Clean up
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('Error exporting video:', error);
        alert('Error exporting video: ' + error.message);
    } finally {
        exportButton.disabled = false;
        exportButton.textContent = 'Export';
    }
}

// Initialize the application when the page loads
window.addEventListener('DOMContentLoaded', init);
