# Web Video Editor

A browser-based video editing application that allows you to edit videos directly in your web browser without requiring any software installation.

## Features

- **Video Trimming**: Cut unwanted sections from your videos
- **Cropping**: Adjust the frame size and remove borders
- **Filters**: Apply visual filters like brightness, contrast, saturation, blur, grayscale, sepia, and invert
- **Timeline Interface**: Drag and drop interface for precise editing
- **Export Options**: Export your edited videos in MP4, WebM, or GIF formats

## Technologies Used

- HTML5, CSS3, JavaScript
- Canvas API for video rendering
- FFmpeg.wasm for video processing
- Bootstrap for UI components

## Getting Started

1. Clone this repository
2. Open `index.html` in your web browser
3. Upload a video file
4. Use the tools panel on the right to edit your video
5. Export your finished video

## Browser Compatibility

This application works best in modern browsers that support HTML5 video and canvas APIs:
- Chrome (recommended)
- Firefox
- Edge
- Safari (limited support for some features)

## Notes

- Video processing occurs entirely in your browser - no files are uploaded to any server
- For best performance, use shorter videos and modern browsers
- Large video files may cause performance issues depending on your device's capabilities