// lib/image-grid.js
//
// Shared pixel-grid helpers for the Image to JSON converter
// (image-converter.html). Pure, DOM-free functions (downsampleToGrid,
// rgbToHex, encodeGrid, decodeGrid) plus one DOM-touching renderer
// (renderGridSvg) that both the live preview and the saved-recipe
// gallery use, so they're guaranteed to render identically.
//
// Storage format is deliberately compact, since these get saved as
// plain-text KV entries (via the existing training-upload category
// store) subject to its 300KB cap: one JSON object
// { width, height, pixels } where `pixels` is a single string of
// concatenated 6-character hex colors, row-major, no separators or
// punctuation -- e.g. a full 32x32 grid is 1024 * 6 = 6144 characters,
// versus tens of KB for an array of {x, y, color} objects.

export const GRID_SIZE = 32;

export function rgbToHex(r, g, b) {
  return [r, g, b].map(function (v) {
    var clamped = Math.max(0, Math.min(255, Math.round(v)));
    var hex = clamped.toString(16);
    return hex.length < 2 ? '0' + hex : hex;
  }).join('');
}

// data: a flat RGBA byte array (Uint8ClampedArray from
// ctx.getImageData(...).data, or a plain array in tests), row-major,
// 4 bytes per source pixel. Returns an array of gridSize*gridSize hex
// color strings (row-major), each the average color of that cell's
// region in the source image ("box downsampling").
export function downsampleToGrid(data, srcWidth, srcHeight, gridSize) {
  var colors = [];

  for (var gy = 0; gy < gridSize; gy++) {
    for (var gx = 0; gx < gridSize; gx++) {
      var x0 = Math.floor((gx / gridSize) * srcWidth);
      var x1 = Math.max(x0 + 1, Math.floor(((gx + 1) / gridSize) * srcWidth));
      var y0 = Math.floor((gy / gridSize) * srcHeight);
      var y1 = Math.max(y0 + 1, Math.floor(((gy + 1) / gridSize) * srcHeight));

      var rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (var y = y0; y < y1 && y < srcHeight; y++) {
        for (var x = x0; x < x1 && x < srcWidth; x++) {
          var idx = (y * srcWidth + x) * 4;
          rSum += data[idx];
          gSum += data[idx + 1];
          bSum += data[idx + 2];
          count++;
        }
      }

      colors.push(count ? rgbToHex(rSum / count, gSum / count, bSum / count) : '000000');
    }
  }

  return colors;
}

export function encodeGrid(hexColors, gridSize) {
  return { width: gridSize, height: gridSize, pixels: hexColors.join('') };
}

// Accepts either an already-parsed { width, height, pixels } object or
// a JSON string of one. Returns a flat array of 6-char hex strings,
// row-major, length width*height.
export function decodeGrid(gridJsonOrString) {
  var grid = typeof gridJsonOrString === 'string' ? JSON.parse(gridJsonOrString) : gridJsonOrString;
  var total = grid.width * grid.height;
  var colors = [];
  for (var i = 0; i < total; i++) {
    colors.push(grid.pixels.slice(i * 6, i * 6 + 6));
  }
  return colors;
}

// Renders a flat hex-color array as a responsive SVG: a fixed
// `gridSize x gridSize` viewBox scaled by CSS width:100% (see the
// .ic-pixel-svg rule on the page), so it fills its container's width
// on any screen size instead of a fixed pixel size, without cutoff.
export function renderGridSvg(hexColors, gridSize) {
  var NS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + gridSize + ' ' + gridSize);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.classList.add('ic-pixel-svg');

  for (var i = 0; i < hexColors.length; i++) {
    var x = i % gridSize;
    var y = Math.floor(i / gridSize);
    var rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', 1);
    rect.setAttribute('height', 1);
    rect.setAttribute('fill', '#' + hexColors[i]);
    svg.appendChild(rect);
  }

  return svg;
}
