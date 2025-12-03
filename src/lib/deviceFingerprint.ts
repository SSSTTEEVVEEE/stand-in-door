// Device fingerprinting library for fraud detection
// Collects extensive device data across multiple categories

const encoder = new TextEncoder();

// ==================== NAVIGATOR & BROWSER ====================
export async function collectNavigatorFingerprint(): Promise<Record<string, any>> {
  const data: Record<string, any> = {};
  
  try {
    // Basic navigator properties
    data.userAgent = navigator.userAgent;
    data.platform = navigator.platform;
    data.language = navigator.language;
    data.languages = navigator.languages ? [...navigator.languages] : [];
    data.hardwareConcurrency = navigator.hardwareConcurrency;
    data.deviceMemory = (navigator as any).deviceMemory;
    data.maxTouchPoints = navigator.maxTouchPoints;
    data.vendor = navigator.vendor;
    data.cookieEnabled = navigator.cookieEnabled;
    data.doNotTrack = navigator.doNotTrack;
    data.pdfViewerEnabled = (navigator as any).pdfViewerEnabled;
    
    // Plugins
    data.plugins = Array.from(navigator.plugins || []).map(p => ({
      name: p.name,
      filename: p.filename,
      description: p.description,
    }));
    
    // MIME types
    data.mimeTypes = Array.from(navigator.mimeTypes || []).map(m => ({
      type: m.type,
      suffixes: m.suffixes,
    }));
    
    // Screen properties
    data.screen = {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      orientation: screen.orientation?.type,
    };
    
    // Window properties
    data.window = {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      devicePixelRatio: window.devicePixelRatio,
    };
    
    // Network Information API
    const connection = (navigator as any).connection;
    if (connection) {
      data.connection = {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
        type: connection.type,
      };
    }
    
    // Battery Status API
    try {
      const battery = await (navigator as any).getBattery?.();
      if (battery) {
        data.battery = {
          charging: battery.charging,
          level: battery.level,
          chargingTime: battery.chargingTime,
          dischargingTime: battery.dischargingTime,
        };
      }
    } catch { /* Battery API not available */ }
    
    // Permissions API status
    try {
      const permissionNames = ['geolocation', 'notifications', 'camera', 'microphone'];
      data.permissions = {};
      for (const name of permissionNames) {
        try {
          const status = await navigator.permissions.query({ name: name as PermissionName });
          data.permissions[name] = status.state;
        } catch { /* Permission not supported */ }
      }
    } catch { /* Permissions API not available */ }
    
    // Media Devices
    try {
      const devices = await navigator.mediaDevices?.enumerateDevices();
      data.mediaDevices = devices?.map(d => ({
        kind: d.kind,
        label: d.label ? 'present' : 'empty',
        groupId: d.groupId?.substring(0, 8),
      }));
    } catch { /* MediaDevices API not available */ }
    
    // Client Hints (if available)
    try {
      if ((navigator as any).userAgentData) {
        const uaData = (navigator as any).userAgentData;
        data.clientHints = {
          brands: uaData.brands,
          mobile: uaData.mobile,
          platform: uaData.platform,
        };
        
        // Try to get high entropy values
        try {
          const highEntropy = await uaData.getHighEntropyValues([
            'architecture', 'bitness', 'model', 'platformVersion', 'fullVersionList'
          ]);
          data.clientHints.highEntropy = highEntropy;
        } catch { /* High entropy not available */ }
      }
    } catch { /* UserAgentData not available */ }
    
  } catch (e) {
    data.error = String(e);
  }
  
  return data;
}

// ==================== CANVAS & WEBGL ====================
export async function collectCanvasWebGLFingerprint(): Promise<Record<string, any>> {
  const data: Record<string, any> = {};
  
  try {
    // Canvas 2D fingerprint
    const canvas = document.createElement('canvas');
    canvas.width = 280;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Draw text with various styles
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.font = '11pt "Times New Roman"';
      ctx.fillText('Cwm fjordbank glyphs vext quiz, 😃', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.font = '18pt Arial';
      ctx.fillText('Cwm fjordbank glyphs vext quiz, 😃', 4, 45);
      
      // Get canvas data and hash it
      const canvasData = canvas.toDataURL();
      data.canvas2dHash = await hashString(canvasData);
    }
    
    // WebGL fingerprint
    const glCanvas = document.createElement('canvas');
    const gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl');
    
    if (gl) {
      const webGLData: Record<string, any> = {};
      
      // Get WebGL parameters
      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        webGLData.vendor = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        webGLData.renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      }
      
      webGLData.version = (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).VERSION);
      webGLData.shadingLanguageVersion = (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).SHADING_LANGUAGE_VERSION);
      webGLData.maxTextureSize = (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).MAX_TEXTURE_SIZE);
      webGLData.maxViewportDims = (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).MAX_VIEWPORT_DIMS);
      webGLData.maxRenderbufferSize = (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).MAX_RENDERBUFFER_SIZE);
      webGLData.maxCubeMapTextureSize = (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).MAX_CUBE_MAP_TEXTURE_SIZE);
      webGLData.maxVertexAttribs = (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).MAX_VERTEX_ATTRIBS);
      webGLData.maxVertexUniformVectors = (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).MAX_VERTEX_UNIFORM_VECTORS);
      webGLData.maxFragmentUniformVectors = (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).MAX_FRAGMENT_UNIFORM_VECTORS);
      webGLData.maxVaryingVectors = (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).MAX_VARYING_VECTORS);
      webGLData.aliasedLineWidthRange = (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).ALIASED_LINE_WIDTH_RANGE);
      webGLData.aliasedPointSizeRange = (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).ALIASED_POINT_SIZE_RANGE);
      
      // Extensions
      webGLData.extensions = (gl as WebGLRenderingContext).getSupportedExtensions();
      
      data.webgl = webGLData;
    }
    
    // WebGL2 check
    const gl2 = glCanvas.getContext('webgl2');
    data.webgl2Supported = !!gl2;
    
    // Audio fingerprint
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const analyser = audioCtx.createAnalyser();
      const gainNode = audioCtx.createGain();
      const scriptProcessor = audioCtx.createScriptProcessor(4096, 1, 1);
      
      gainNode.gain.value = 0;
      oscillator.type = 'triangle';
      oscillator.connect(analyser);
      analyser.connect(scriptProcessor);
      scriptProcessor.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start(0);
      
      data.audioContext = {
        sampleRate: audioCtx.sampleRate,
        state: audioCtx.state,
        baseLatency: (audioCtx as any).baseLatency,
        outputLatency: (audioCtx as any).outputLatency,
      };
      
      oscillator.stop();
      audioCtx.close();
    } catch { /* AudioContext not available */ }
    
  } catch (e) {
    data.error = String(e);
  }
  
  return data;
}

// ==================== SENSORS & WEBRTC ====================
export async function collectSensorWebRTCFingerprint(): Promise<Record<string, any>> {
  const data: Record<string, any> = {};
  
  try {
    // Sensor availability
    data.sensors = {
      accelerometer: 'Accelerometer' in window,
      gyroscope: 'Gyroscope' in window,
      magnetometer: 'Magnetometer' in window,
      ambientLightSensor: 'AmbientLightSensor' in window,
      proximitySensor: 'ProximitySensor' in window,
      linearAccelerationSensor: 'LinearAccelerationSensor' in window,
      gravityensor: 'GravitySensor' in window,
      absoluteOrientationSensor: 'AbsoluteOrientationSensor' in window,
      relativeOrientationSensor: 'RelativeOrientationSensor' in window,
    };
    
    // WebRTC local IP detection (for proxy detection)
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      const candidates: string[] = [];
      
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 2000);
        
        pc.onicecandidate = (event) => {
          if (!event.candidate) {
            clearTimeout(timeout);
            resolve();
            return;
          }
          candidates.push(event.candidate.candidate);
        };
      });
      
      pc.close();
      
      // Extract IP patterns (hashed for privacy)
      const ipPatterns = candidates
        .filter(c => c.includes('candidate'))
        .map(c => {
          const match = c.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
          return match ? 'ipv4-detected' : c.includes(':') ? 'ipv6-detected' : 'unknown';
        });
      
      data.webrtc = {
        candidateCount: candidates.length,
        ipPatterns: [...new Set(ipPatterns)],
      };
    } catch { /* WebRTC not available */ }
    
    // Speech synthesis voices (fingerprint)
    try {
      if ('speechSynthesis' in window) {
        const voices = speechSynthesis.getVoices();
        data.speechVoices = voices.length || 'loading';
      }
    } catch { /* Speech synthesis not available */ }
    
  } catch (e) {
    data.error = String(e);
  }
  
  return data;
}

// ==================== STORAGE & FEATURES ====================
export async function collectStorageFeatureFingerprint(): Promise<Record<string, any>> {
  const data: Record<string, any> = {};
  
  try {
    // Storage availability
    data.storage = {
      localStorage: !!window.localStorage,
      sessionStorage: !!window.sessionStorage,
      indexedDB: !!window.indexedDB,
      caches: 'caches' in window,
      serviceWorker: 'serviceWorker' in navigator,
    };
    
    // Modern API detection
    data.apis = {
      webAssembly: typeof WebAssembly !== 'undefined',
      sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
      webGPU: 'gpu' in navigator,
      webBluetooth: 'bluetooth' in navigator,
      webUSB: 'usb' in navigator,
      webHID: 'hid' in navigator,
      webSerial: 'serial' in navigator,
      webNFC: 'NDEFReader' in window,
      webMIDI: 'requestMIDIAccess' in navigator,
      webXR: 'xr' in navigator,
      webVR: 'getVRDisplays' in navigator,
      presentation: 'presentation' in navigator,
      wakeLock: 'wakeLock' in navigator,
      share: 'share' in navigator,
      clipboard: 'clipboard' in navigator,
      credentials: 'credentials' in navigator,
      paymentRequest: 'PaymentRequest' in window,
      geolocation: 'geolocation' in navigator,
      notifications: 'Notification' in window,
      pushManager: 'PushManager' in window,
      deviceOrientation: 'DeviceOrientationEvent' in window,
      deviceMotion: 'DeviceMotionEvent' in window,
      gamepad: 'getGamepads' in navigator,
      vibrate: 'vibrate' in navigator,
      keyboard: 'keyboard' in navigator,
      locks: 'locks' in navigator,
      idle: 'IdleDetector' in window,
      fileSystem: 'showOpenFilePicker' in window,
      screenCapture: 'getDisplayMedia' in (navigator.mediaDevices || {}),
      pictureInPicture: 'pictureInPictureEnabled' in document,
    };
    
    // CSS Media Queries
    data.mediaQueries = {
      prefersColorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      prefersReducedTransparency: window.matchMedia('(prefers-reduced-transparency: reduce)').matches,
      prefersContrast: window.matchMedia('(prefers-contrast: more)').matches ? 'more' : 'normal',
      forcedColors: window.matchMedia('(forced-colors: active)').matches,
      invertedColors: window.matchMedia('(inverted-colors: inverted)').matches,
      hover: window.matchMedia('(hover: hover)').matches ? 'hover' : 'none',
      pointer: window.matchMedia('(pointer: fine)').matches ? 'fine' : 'coarse',
      standAlone: window.matchMedia('(display-mode: standalone)').matches,
    };
    
    // Timezone & locale
    data.timezone = {
      offset: new Date().getTimezoneOffset(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: Intl.DateTimeFormat().resolvedOptions().locale,
    };
    
    // Storage estimate
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        data.storageEstimate = {
          quota: estimate.quota,
          usage: estimate.usage,
        };
      }
    } catch { /* Storage estimate not available */ }
    
  } catch (e) {
    data.error = String(e);
  }
  
  return data;
}

// ==================== TIMING & PERFORMANCE ====================
export async function collectTimingPerformanceFingerprint(): Promise<Record<string, any>> {
  const data: Record<string, any> = {};
  
  try {
    // Performance timing
    if (performance.timing) {
      const timing = performance.timing;
      data.timing = {
        navigationStart: timing.navigationStart,
        domainLookupEnd: timing.domainLookupEnd - timing.domainLookupStart,
        connectEnd: timing.connectEnd - timing.connectStart,
        responseEnd: timing.responseEnd - timing.requestStart,
        domComplete: timing.domComplete - timing.domLoading,
        loadEventEnd: timing.loadEventEnd - timing.navigationStart,
      };
    }
    
    // Performance memory (Chrome only)
    if ((performance as any).memory) {
      data.memory = {
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
      };
    }
    
    // Timing resolution detection
    const timingTests: number[] = [];
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      const end = performance.now();
      timingTests.push(end - start);
    }
    data.timingResolution = Math.min(...timingTests.filter(t => t > 0)) || 'high-precision';
    
    // Resource timing
    const resources = performance.getEntriesByType('resource').slice(0, 5);
    data.resourceTimingSamples = resources.map(r => ({
      initiatorType: (r as PerformanceResourceTiming).initiatorType,
      transferSize: (r as PerformanceResourceTiming).transferSize,
      encodedBodySize: (r as PerformanceResourceTiming).encodedBodySize,
    }));
    
    // Navigation type
    if (performance.navigation) {
      data.navigationType = performance.navigation.type;
      data.redirectCount = performance.navigation.redirectCount;
    }
    
  } catch (e) {
    data.error = String(e);
  }
  
  return data;
}

// ==================== UTILITY FUNCTIONS ====================
async function hashString(str: string): Promise<string> {
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

export function extractStableFingerprint(data: Record<string, any>): Record<string, any> {
  // Filter out dynamic values that change frequently
  const stable: Record<string, any> = {};
  const dynamicKeys = ['timestamp', 'battery', 'memory', 'timing', 'resourceTimingSamples'];
  
  for (const [key, value] of Object.entries(data)) {
    if (!dynamicKeys.includes(key)) {
      stable[key] = value;
    }
  }
  
  return stable;
}

export async function hashFingerprint(data: Record<string, any>): Promise<string> {
  const stable = extractStableFingerprint(data);
  const json = JSON.stringify(stable, Object.keys(stable).sort());
  return hashString(json);
}

// ==================== MAIN COLLECTION FUNCTION ====================
export async function collectAllFingerprints(): Promise<{
  navigator: Record<string, any>;
  canvas: Record<string, any>;
  sensors: Record<string, any>;
  storage: Record<string, any>;
  timing: Record<string, any>;
  collectedAt: string;
  integrityHash: string;
}> {
  const [navigator, canvas, sensors, storage, timing] = await Promise.all([
    collectNavigatorFingerprint(),
    collectCanvasWebGLFingerprint(),
    collectSensorWebRTCFingerprint(),
    collectStorageFeatureFingerprint(),
    collectTimingPerformanceFingerprint(),
  ]);
  
  const combined = { navigator, canvas, sensors, storage, timing };
  const integrityHash = await hashFingerprint(combined);
  
  return {
    ...combined,
    collectedAt: new Date().toISOString(),
    integrityHash,
  };
}
