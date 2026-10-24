'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import jsQR from 'jsqr';

interface DetectedBarcode {
  rawValue: string;
  format?: string;
}

interface BarcodeDetectorInstance {
  detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats: string[] }): BarcodeDetectorInstance;
      getSupportedFormats?(): Promise<string[]>;
    };
  }
}

interface EntitlementItem {
  id: string;
  code: string;
  title: string;
  status: 'AVAILABLE' | 'REDEEMED' | 'EXPIRED' | 'REVOKED';
  redeemedAt: string | null;
}

interface LookupResult {
  registrationId: string;
  ticketCode: string;
  status: string;
  checkedInAt: string | null;
  person: {
    name: string;
    email: string;
    phone: string | null;
    company: string | null;
    jobTitle: string | null;
  };
  event: {
    title: string;
    venue: string;
  };
  meals: EntitlementItem[];
  sessions: EntitlementItem[];
  stats: {
    mealsTotal: number;
    mealsRedeemed: number;
    sessionsTotal: number;
    sessionsRedeemed: number;
    checkedIn: boolean;
  };
}

const AUTHORIZED_STATIONS = [
  { code: 'MEAL_D1_BREAKFAST', label: 'Day 1: Breakfast Buffet (08:00 - 09:30)', category: 'MEAL', icon: '☕' },
  { code: 'MEAL_D1_LUNCH', label: 'Day 1: Executive Lunch (12:30 - 14:00)', category: 'MEAL', icon: '🍽️' },
  { code: 'MEAL_D1_DINNER', label: 'Day 1: Welcome Gala Dinner (19:00 - 21:30)', category: 'MEAL', icon: '🍷' },
  { code: 'MEAL_D2_BREAKFAST', label: 'Day 2: Breakfast Buffet (08:00 - 09:30)', category: 'MEAL', icon: '☕' },
  { code: 'MEAL_D2_LUNCH', label: 'Day 2: Executive Lunch (12:30 - 14:00)', category: 'MEAL', icon: '🍽️' },
  { code: 'MEAL_D2_DINNER', label: 'Day 2: Networking Banquet (19:00 - 21:30)', category: 'MEAL', icon: '🥂' },
  { code: 'MEAL_D3_BREAKFAST', label: 'Day 3: Breakfast Buffet (08:00 - 09:30)', category: 'MEAL', icon: '☕' },
  { code: 'MEAL_D3_LUNCH', label: 'Day 3: Farewell Lunch (12:30 - 14:00)', category: 'MEAL', icon: '🍽️' },
  { code: 'MEAL_D3_DINNER', label: 'Day 3: Closing Dinner (19:00 - 21:00)', category: 'MEAL', icon: '🍲' },
  { code: 'SES_01_KEYNOTE', label: 'Session 01: Keynote & Opening Ceremony', category: 'SESSION', icon: '🎙️' },
  { code: 'SES_07_WORKSHOP_A', label: 'Session 07: Hands-On Microservices Lab', category: 'SESSION', icon: '💻' },
  { code: 'SES_08_WORKSHOP_B', label: 'Session 08: Distributed Consensus Workshop', category: 'SESSION', icon: '🔬' },
];

export default function ScannerPage() {
  const router = useRouter();
  const [tokenInput, setTokenInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LookupResult | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [redeemingCode, setRedeemingCode] = useState<string | null>(null);

  // User Role & Vendor Station State
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [stationMode, setStationMode] = useState<boolean>(true);
  const [selectedStationCode, setSelectedStationCode] = useState<string>('MEAL_D1_LUNCH');
  const [stationsList, setStationsList] = useState<Array<{ code: string; label: string; category: string; icon: string }>>(AUTHORIZED_STATIONS);
  const [stationTally, setStationTally] = useState<number>(0);
  const [stationResult, setStationResult] = useState<{
    status: 'SUCCESS' | 'ALREADY_REDEEMED' | 'INVALID' | 'ERROR';
    message: string;
    participantName?: string;
    ticketCode?: string;
    stationTitle?: string;
  } | null>(null);

  const stationModeRef = useRef<boolean>(true);
  const selectedStationCodeRef = useRef<string>('MEAL_D1_LUNCH');
  const stationsListRef = useRef<Array<{ code: string; label: string; category: string; icon: string }>>(AUTHORIZED_STATIONS);

  useEffect(() => {
    stationModeRef.current = stationMode;
  }, [stationMode]);

  useEffect(() => {
    selectedStationCodeRef.current = selectedStationCode;
  }, [selectedStationCode]);

  useEffect(() => {
    stationsListRef.current = stationsList;
  }, [stationsList]);

  // Load user role and active event stations
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.authenticated && d.user) {
          if (d.user.role === 'OPERATOR') {
            router.replace('/participants');
            return;
          }
          setCurrentUserRole(d.user.role);
          setCurrentUserName(d.user.name);
          if (d.user.role === 'VENDOR') {
            setStationMode(true);
          }

          // Dynamically load active event's stations!
          const evStations = d.event?.stations;
          if (Array.isArray(evStations) && evStations.length > 0) {
            setStationsList(evStations);
            stationsListRef.current = evStations;

            if (d.user.assignedStationCode) {
              setSelectedStationCode(d.user.assignedStationCode);
              selectedStationCodeRef.current = d.user.assignedStationCode;
            } else if (!evStations.some((s: any) => s.code === selectedStationCodeRef.current)) {
              setSelectedStationCode(evStations[0].code);
              selectedStationCodeRef.current = evStations[0].code;
            }
          }
        }
      })
      .catch(() => {});
  }, [router]);

  // Camera Scanner State
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopActive = useRef<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // High pitch chime for successful scan
  const playBeep = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // High clear A5 note
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {}
  }, []);

  // Low buzz warning for duplicates/errors
  const playWarningBeep = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.22, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch {}
  }, []);

  // Quick preset test tokens
  const sampleAttendees = [
    { name: 'Sarah Connor (Clean 19 Available)', token: 'ec_tok_38a611a2997ae40cc0b0b47b60330c384f085175d5b5a3876e68e9ff2cb722f0' },
    { name: 'Marcus Vance (Partially Redeemed)', token: 'ec_tok_242632ba2f0f3c6795b345cf704fa871adb9fab949acb1ae3798f78d5444c880' },
    { name: 'Elena Rostova (Attended 5 items)', token: 'ec_tok_2a0961d9fa0a406aa134713d3c0b466ab811f113f3d795345634c5bfe3bbe534' },
    { name: 'Devon Reed (VIP Unredeemed)', token: 'ec_tok_22fe00ec7b4362e9689cebdb8b308fccd28a2f048ea46f205cd67a9bf547846d' },
  ];

  const handleLookup = useCallback(async (tokenToLookup?: string) => {
    const rawToken = (tokenToLookup || tokenInput).trim();
    if (!rawToken) {
      setFeedback({ type: 'warning', message: 'Please enter or scan a valid QR token.' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/scan/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken: rawToken }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to resolve QR token');
      }

      setData(resData);
      setTokenInput(rawToken);
      setFeedback({
        type: 'success',
        message: `Verified: ${resData.person.name} (${resData.ticketCode}) — Ready for check-in & redemptions.`,
      });
    } catch (err: unknown) {
      setData(null);
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Lookup failed' });
    } finally {
      setLoading(false);
    }
  }, [tokenInput]);

  const handleStationRedeem = useCallback(
    async (token: string, stationCode: string) => {
      const rawToken = token.trim();
      if (!rawToken) {
        setFeedback({ type: 'warning', message: 'Please enter or scan a valid QR badge or ticket code.' });
        return;
      }

      setLoading(true);
      setStationResult(null);
      setFeedback(null);
      setData(null);

      try {
        const res = await fetch('/api/scan/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            qrToken: rawToken,
            entitlementCode: stationCode,
            deviceInfo: `${currentUserName || 'Staff'} Station Scanner`,
          }),
        });

        const resData = await res.json();
        const stationDef =
          stationsListRef.current.find((s) => s.code === stationCode) ||
          AUTHORIZED_STATIONS.find((s) => s.code === stationCode);

        if (res.ok && resData.success) {
          playBeep();
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate(120);
            } catch {}
          }
          setStationTally((prev) => prev + 1);
          setStationResult({
            status: 'SUCCESS',
            message: resData.message || 'Access Granted! Entitlement Claimed.',
            participantName: resData.participant?.name || 'Attendee',
            ticketCode: resData.participant?.ticketCode || '',
            stationTitle: stationDef?.label || stationCode,
          });
        } else if (res.status === 409 || resData.result === 'ALREADY_REDEEMED') {
          playWarningBeep();
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate([100, 80, 100]);
            } catch {}
          }
          setStationResult({
            status: 'ALREADY_REDEEMED',
            message: resData.message || 'DUPLICATE ATTEMPT: Already redeemed earlier.',
            participantName: resData.participant?.name || 'Attendee',
            ticketCode: resData.participant?.ticketCode || '',
            stationTitle: stationDef?.label || stationCode,
          });
        } else {
          playWarningBeep();
          setStationResult({
            status: 'INVALID',
            message: resData.error || resData.message || 'Invalid QR code or ticket reference.',
            stationTitle: stationDef?.label || stationCode,
          });
        }
      } catch (err: unknown) {
        playWarningBeep();
        setStationResult({
          status: 'ERROR',
          message: err instanceof Error ? err.message : 'Network error during redemption.',
          stationTitle: stationCode,
        });
      } finally {
        setLoading(false);
      }
    },
    [currentUserName, playBeep, playWarningBeep]
  );

  const stopCamera = useCallback(() => {
    scanLoopActive.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
    setTorchSupported(false);
    setCameraActive(false);
    setCameraLoading(false);
  }, []);

  const facingModeRef = useRef<'environment' | 'user'>('environment');

  // Universal QR scan loop powered by native BarcodeDetector + jsQR fallback
  const startScanLoop = useCallback(() => {
    let detector: BarcodeDetectorInstance | null = null;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window && window.BarcodeDetector) {
      try {
        detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch {
        detector = null;
      }
    }

    if (!canvasRef.current && typeof document !== 'undefined') {
      canvasRef.current = document.createElement('canvas');
    }

    const scanFrame = async () => {
      if (!scanLoopActive.current || !videoRef.current) return;
      const video = videoRef.current;

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        let detectedCode: string | null = null;

        // 1. Try hardware-accelerated BarcodeDetector if available
        if (detector) {
          try {
            const barcodes = await detector.detect(video);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              detectedCode = barcodes[0].rawValue;
            }
          } catch {
            // Fallback to jsQR
          }
        }

        // 2. Universal jsQR decoder
        if (!detectedCode && canvasRef.current) {
          try {
            const canvas = canvasRef.current;
            const maxDim = 640;
            let w = video.videoWidth;
            let h = video.videoHeight;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            canvas.width = w;
            canvas.height = h;

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, w, h);
              const imgData = ctx.getImageData(0, 0, w, h);
              const result = jsQR(imgData.data, imgData.width, imgData.height, {
                inversionAttempts: 'dontInvert',
              });
              if (result && result.data) {
                detectedCode = result.data;
              }
            }
          } catch {
            // Frame skip
          }
        }

        if (detectedCode) {
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate(120);
            } catch {}
          }
          stopCamera();
          if (stationModeRef.current && selectedStationCodeRef.current) {
            await handleStationRedeem(detectedCode, selectedStationCodeRef.current);
          } else {
            playBeep();
            await handleLookup(detectedCode);
          }
          return;
        }
      }

      if (scanLoopActive.current) {
        requestAnimationFrame(scanFrame);
      }
    };

    requestAnimationFrame(scanFrame);
  }, [handleLookup, handleStationRedeem, playBeep, stopCamera]);

  // Robust stream attachment to HTML video element
  const attachStreamToVideo = useCallback((video: HTMLVideoElement | null, stream: MediaStream | null) => {
    if (!video || !stream) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.muted = true;

    const playVideo = () => {
      video.play().catch(() => {});
    };

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      playVideo();
    } else {
      video.onloadedmetadata = playVideo;
    }
  }, []);

  // Callback ref that immediately attaches stream when video node mounts
  const videoElementRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      attachStreamToVideo(node, streamRef.current);
    }
  }, [attachStreamToVideo]);

  // Start Camera with multi-tiered constraint fallback
  const startCamera = useCallback(async (mode?: 'environment' | 'user') => {
    const targetMode = mode || facingModeRef.current;
    facingModeRef.current = targetMode;
    setFacingMode(targetMode);

    setCameraError(null);
    setCameraLoading(true);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera API is not supported in this browser. Please ensure you are opening over HTTPS or localhost.');
      setCameraLoading(false);
      return;
    }

    // Stop previous tracks cleanly to release camera lock
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try { track.stop(); } catch {}
      });
      streamRef.current = null;
    }

    let stream: MediaStream | null = null;

    try {
      // 1. Preferred facingMode with ideal HD resolution
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: targetMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch {
      try {
        // 2. Simple facingMode constraint
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: targetMode },
          audio: false,
        });
      } catch {
        try {
          // 3. Fallback to any available camera device (desktop/laptop webcams)
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Camera access error';
          setCameraError(`${msg}. Please check camera permissions in your browser.`);
          setCameraActive(false);
          setCameraLoading(false);
          return;
        }
      }
    }

    if (!stream) {
      setCameraError('Could not initialize camera stream.');
      setCameraActive(false);
      setCameraLoading(false);
      return;
    }

    streamRef.current = stream;

    // Detect actual facing mode of the acquired track
    const track = stream.getVideoTracks()[0];
    if (track) {
      const settings = track.getSettings?.();
      if (settings?.facingMode && (settings.facingMode === 'user' || settings.facingMode === 'environment')) {
        facingModeRef.current = settings.facingMode;
        setFacingMode(settings.facingMode);
      }
      // Check torch capability
      try {
        const capabilities = track.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
        setTorchSupported(Boolean(capabilities?.torch));
      } catch {
        setTorchSupported(false);
      }
    }

    setCameraActive(true);
    setCameraLoading(false);

    // Immediately attach stream if video ref is available
    if (videoRef.current) {
      attachStreamToVideo(videoRef.current, stream);
    }

    scanLoopActive.current = true;
    startScanLoop();
  }, [attachStreamToVideo, startScanLoop]);

  // Flipping between rear and front camera
  const toggleFacingMode = useCallback(async () => {
    const nextMode: 'environment' | 'user' = facingModeRef.current === 'environment' ? 'user' : 'environment';
    await startCamera(nextMode);
  }, [startCamera]);

  // Toggle torch / flashlight
  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track && 'applyConstraints' in track) {
      try {
        const next = !torchOn;
        await (track as unknown as { applyConstraints: (c: unknown) => Promise<void> }).applyConstraints({
          advanced: [{ torch: next }],
        });
        setTorchOn(next);
      } catch {}
    }
  };

  // Automatic camera initialization once on mount
  const hasMountedRef = useRef(false);
  useEffect(() => {
    if (hasMountedRef.current) return;
    hasMountedRef.current = true;

    void startCamera('environment');

    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Universal photo decoding using jsQR
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setFeedback(null);

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image file'));
        img.src = objectUrl;
      });

      const canvas = document.createElement('canvas');
      const maxDim = 1200;
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Could not create image canvas context');
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(objectUrl);

      const imgData = ctx.getImageData(0, 0, w, h);
      const result = jsQR(imgData.data, imgData.width, imgData.height, {
        inversionAttempts: 'attemptBoth',
      });

      if (result && result.data) {
        playBeep();
        await handleLookup(result.data);
      } else {
        setFeedback({
          type: 'error',
          message: 'No QR code could be read from this photo. Ensure the QR code is clear, well-lit, and in focus.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to scan image';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleRedeem = async (entitlementCode: string) => {
    if (!tokenInput) return;

    setRedeemingCode(entitlementCode);
    setFeedback(null);

    try {
      const res = await fetch('/api/scan/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrToken: tokenInput,
          entitlementCode,
          deviceInfo: 'Web Scanner Desk Station',
        }),
      });

      const resData = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setFeedback({
            type: 'error',
            message: resData.message || 'DUPLICATE: This entitlement has already been redeemed.',
          });
        } else {
          setFeedback({
            type: 'error',
            message: resData.message || 'Redemption rejected.',
          });
        }
      } else {
        setFeedback({
          type: 'success',
          message: resData.message || 'Entitlement redeemed successfully!',
        });
      }

      // Refresh participant state
      await handleLookup(tokenInput);
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: `Redemption error: ${err instanceof Error ? err.message : 'Unknown error'}` });
    } finally {
      setRedeemingCode(null);
    }
  };

  if (currentUserRole === 'OPERATOR') {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem', maxWidth: '520px', margin: '2rem auto' }} className="card">
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚫</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-heading)' }}>
          Scanner Access Restricted
        </h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.65rem', marginBottom: '1.5rem', fontSize: '0.92rem', lineHeight: 1.5 }}>
          Registration desk staff accounts are not authorized to operate QR scanner stations. Please proceed to the participants management dashboard.
        </p>
        <Link href="/participants" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <span>👥</span> Return to Participants
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header Title */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-heading)' }}>
          {currentUserRole === 'VENDOR' ? 'Vendor Station Scanner' : 'QR Scanner & Entitlement Station'}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
          {currentUserRole === 'VENDOR'
            ? 'Scan attendee QR badge to instantly redeem meals and kits at your assigned counter.'
            : 'Scan attendee QR badge with camera to verify registration and atomically claim meals and session passes.'}
        </p>
      </div>

      {/* Station Configuration & Mode Selector */}
      <div
        className="card"
        style={{
          border: '1.5px solid var(--border-color)',
          background: 'linear-gradient(to right, #f8fafc, #ffffff)',
          padding: '1.15rem 1.35rem',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', width: '100%', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 280px', minWidth: 0, maxWidth: '100%' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'var(--primary)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.35rem',
                flexShrink: 0,
                boxShadow: '0 4px 10px rgba(13, 98, 94, 0.2)',
              }}
            >
              🏢
            </div>
            <div style={{ flex: 1, minWidth: 0, maxWidth: '100%' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {currentUserRole === 'VENDOR' ? 'Your Assigned Counter' : 'Operating Counter'}
              </div>
              <div style={{ width: '100%', minWidth: 0, maxWidth: '100%', marginTop: '3px' }}>
                <select
                  value={selectedStationCode}
                  onChange={(e) => {
                    setSelectedStationCode(e.target.value);
                    setStationResult(null);
                  }}
                  style={{
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--primary)',
                    background: 'white',
                    color: 'var(--text-heading)',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    outline: 'none',
                    cursor: 'pointer',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {stationsList.some((s) => s.category === 'MEAL') && (
                    <optgroup label="🍽️ Conference Meal Counters">
                      {stationsList
                        .filter((s) => s.category === 'MEAL')
                        .map((st) => (
                          <option key={st.code} value={st.code}>
                            {st.icon || '🍽️'} {st.label}
                          </option>
                        ))}
                    </optgroup>
                  )}
                  {stationsList.some((s) => s.category === 'SESSION') && (
                    <optgroup label="🎙️ Scientific Sessions & Workshops">
                      {stationsList
                        .filter((s) => s.category === 'SESSION')
                        .map((st) => (
                          <option key={st.code} value={st.code}>
                            {st.icon || '🎙️'} {st.label}
                          </option>
                        ))}
                    </optgroup>
                  )}
                  {stationsList.some((s) => s.category === 'KIT') && (
                    <optgroup label="🎒 Delegate Kit & Distribution Counters">
                      {stationsList
                        .filter((s) => s.category === 'KIT')
                        .map((st) => (
                          <option key={st.code} value={st.code}>
                            {st.icon || '🎒'} {st.label}
                          </option>
                        ))}
                    </optgroup>
                  )}
                  {stationsList.some((s) => !['MEAL', 'SESSION', 'KIT'].includes(s.category)) && (
                    <optgroup label="🏢 Additional Entitlement Counters">
                      {stationsList
                        .filter((s) => !['MEAL', 'SESSION', 'KIT'].includes(s.category))
                        .map((st) => (
                          <option key={st.code} value={st.code}>
                            {st.icon || '🏢'} {st.label}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Live Station Tally */}
            <div
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                fontSize: '0.85rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>✅</span>
              <span>{stationTally} Claimed This Shift</span>
            </div>

            {/* Toggle Station Auto-Scan vs Universal for Staff */}
            {currentUserRole !== 'VENDOR' && (
              <button
                type="button"
                onClick={() => setStationMode((prev) => !prev)}
                className="btn btn-secondary btn-sm"
                style={{
                  borderColor: stationMode ? 'var(--primary)' : 'var(--border-color)',
                  color: stationMode ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                }}
              >
                {stationMode ? '⚡ Fast Auto-Claim Mode' : '🔍 Inspection Mode'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Giant High-Visibility Station Status Feedback */}
      {stationResult && (
        <div
          style={{
            borderRadius: '16px',
            padding: '1.5rem 1.75rem',
            color: 'white',
            background:
              stationResult.status === 'SUCCESS'
                ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                : stationResult.status === 'ALREADY_REDEEMED'
                ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                : 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
            boxShadow:
              stationResult.status === 'SUCCESS'
                ? '0 10px 25px -5px rgba(5, 150, 105, 0.35)'
                : stationResult.status === 'ALREADY_REDEEMED'
                ? '0 10px 25px -5px rgba(220, 38, 38, 0.35)'
                : '0 10px 25px -5px rgba(217, 119, 6, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                flexShrink: 0,
              }}
            >
              {stationResult.status === 'SUCCESS' ? '✓' : stationResult.status === 'ALREADY_REDEEMED' ? '⚠️' : '✕'}
            </div>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
                {stationResult.status === 'SUCCESS'
                  ? 'ACCESS GRANTED'
                  : stationResult.status === 'ALREADY_REDEEMED'
                  ? 'ALREADY CLAIMED'
                  : 'INVALID TOKEN'}
              </div>
              <div style={{ fontSize: '0.98rem', fontWeight: 600, opacity: 0.95, marginTop: '2px' }}>
                {stationResult.stationTitle}
              </div>
              {stationResult.participantName && (
                <div style={{ fontSize: '0.88rem', opacity: 0.88, marginTop: '4px' }}>
                  Attendee: <strong>{stationResult.participantName}</strong>{' '}
                  {stationResult.ticketCode ? `• Ticket: ${stationResult.ticketCode}` : ''}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setStationResult(null);
                if (!cameraActive) void startCamera(facingMode);
              }}
              style={{
                background: 'white',
                color:
                  stationResult.status === 'SUCCESS'
                    ? '#059669'
                    : stationResult.status === 'ALREADY_REDEEMED'
                    ? '#dc2626'
                    : '#d97706',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.92rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              ▶ Scan Next Attendee
            </button>
            <button
              type="button"
              onClick={() => setStationResult(null)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: 'none',
                padding: '10px 14px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Scanner Input Card */}
      <div className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <label style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-heading)' }}>
              Live Camera Feed or Manual Code Entry:
            </label>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={cameraActive ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'}
                onClick={() => (cameraActive ? stopCamera() : void startCamera(facingMode))}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span>{cameraActive ? '⏹ Pause Camera' : '📷 Start Camera'}</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => photoInputRef.current?.click()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span>📁 Upload Image</span>
              </button>
              <input
                type="file"
                ref={photoInputRef}
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {/* Camera Viewfinder Overlay */}
          {(cameraActive || cameraLoading) && (
            <div
              style={{
                position: 'relative',
                background: '#041715',
                borderRadius: '16px',
                overflow: 'hidden',
                border: '2px solid var(--primary)',
                minHeight: '260px',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              {cameraLoading && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    background: 'rgba(4, 23, 21, 0.85)',
                    zIndex: 2,
                  }}
                >
                  <span style={{ marginRight: '8px' }}>🔄</span> Connecting camera stream...
                </div>
              )}

              <video
                ref={videoElementRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  maxHeight: '380px',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />

              {/* Viewfinder Targeting HUD */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    width: '230px',
                    height: '230px',
                    border: '2px dashed rgba(5, 150, 105, 0.85)',
                    borderRadius: '20px',
                    boxShadow: '0 0 0 9999px rgba(8, 30, 28, 0.45)',
                    position: 'relative',
                  }}
                >
                  {/* Targeting corner markers */}
                  <div style={{ position: 'absolute', top: '-2px', left: '-2px', width: '20px', height: '20px', borderTop: '4px solid #10b981', borderLeft: '4px solid #10b981', borderTopLeftRadius: '18px' }} />
                  <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '20px', height: '20px', borderTop: '4px solid #10b981', borderRight: '4px solid #10b981', borderTopRightRadius: '18px' }} />
                  <div style={{ position: 'absolute', bottom: '-2px', left: '-2px', width: '20px', height: '20px', borderBottom: '4px solid #10b981', borderLeft: '4px solid #10b981', borderBottomLeftRadius: '18px' }} />
                  <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '20px', height: '20px', borderBottom: '4px solid #10b981', borderRight: '4px solid #10b981', borderBottomRightRadius: '18px' }} />

                  {/* Scanning beam line */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '0',
                      right: '0',
                      height: '2px',
                      background: 'linear-gradient(90deg, transparent, #10b981, transparent)',
                      boxShadow: '0 0 10px #10b981',
                    }}
                  />
                </div>
              </div>

              {/* Camera Controls Bar */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  right: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.94)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid var(--border-subtle)',
                  padding: '8px 14px',
                  borderRadius: '9999px',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.12)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669', display: 'inline-block', boxShadow: '0 0 6px #059669' }} />
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-heading)', fontWeight: 700 }}>
                    {facingMode === 'environment' ? 'Rear Camera Active' : 'Front Camera Active'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {torchSupported && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={toggleTorch}
                      title="Toggle flashlight"
                      style={{ padding: '4px 12px', fontSize: '0.78rem' }}
                    >
                      {torchOn ? '🔦 Torch On' : '💡 Torch'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => void toggleFacingMode()}
                    style={{ padding: '4px 14px', fontSize: '0.78rem' }}
                  >
                    🔄 Flip Camera
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={stopCamera}
                    style={{ padding: '4px 12px', fontSize: '0.78rem' }}
                  >
                    ✕ Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {cameraError && (
            <div
              style={{
                padding: '0.85rem 1.15rem',
                borderRadius: '12px',
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                color: 'var(--danger)',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div>
                <strong>Camera Notice:</strong> {cameraError}
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void startCamera(facingMode)}
                style={{ fontSize: '0.78rem' }}
              >
                Retry Camera
              </button>
            </div>
          )}

          <div className="scanner-input-group">
            <input
              type="text"
              className="form-input"
              placeholder={
                stationMode
                  ? 'Scan QR or type Ticket Code (e.g. EC-2026-0008) to redeem at counter'
                  : 'Scan QR code or enter ticket code (e.g. EC-2026-0008 or ec_tok_...)'
              }
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (stationMode) {
                    void handleStationRedeem(tokenInput, selectedStationCode);
                  } else {
                    void handleLookup();
                  }
                }
              }}
              style={{ fontFamily: 'monospace' }}
            />
            {stationMode ? (
              <button
                type="button"
                onClick={() => void handleStationRedeem(tokenInput, selectedStationCode)}
                disabled={loading || !tokenInput.trim()}
                className="btn btn-primary"
                style={{ fontWeight: 800, whiteSpace: 'nowrap' }}
              >
                {loading ? 'Claiming...' : 'Redeem at Station'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleLookup()}
                disabled={loading || !tokenInput.trim()}
                className="btn btn-primary"
                style={{ fontWeight: 800, whiteSpace: 'nowrap' }}
              >
                {loading ? 'Verifying...' : 'Verify Attendee'}
              </button>
            )}

            {stationMode && currentUserRole !== 'VENDOR' && (
              <button
                type="button"
                onClick={() => void handleLookup()}
                disabled={loading || !tokenInput.trim()}
                className="btn btn-secondary"
                style={{ whiteSpace: 'nowrap' }}
                title="View full attendee profile & all 19 entitlements"
              >
                Inspect All
              </button>
            )}
          </div>

          {/* Quick presets for local testing (Hidden for Vendors in production) */}
          {currentUserRole !== 'VENDOR' && (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Quick Presets:
              </span>
              {sampleAttendees.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    if (stationMode) {
                      void handleStationRedeem(sample.token, selectedStationCode);
                    } else {
                      void handleLookup(sample.token);
                    }
                  }}
                >
                  {sample.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            fontSize: '0.95rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            backgroundColor:
              feedback.type === 'success'
                ? 'var(--success-bg)'
                : feedback.type === 'warning'
                ? 'var(--warning-bg)'
                : 'var(--danger-bg)',
            color:
              feedback.type === 'success'
                ? 'var(--success)'
                : feedback.type === 'warning'
                ? 'var(--warning)'
                : 'var(--danger)',
            border: `1px solid ${
              feedback.type === 'success'
                ? 'var(--success-border)'
                : feedback.type === 'warning'
                ? 'var(--warning-border)'
                : 'var(--danger-border)'
            }`,
          }}
        >
          <span>{feedback.type === 'success' ? '✓' : feedback.type === 'warning' ? '⚠' : '✕'}</span>
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Lookup Participant Details & Entitlement Grid (Admins & Desk Staff only) */}
      {data && currentUserRole !== 'VENDOR' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Attendee Profile Badge */}
          <div
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1.5rem',
              borderLeft: '5px solid var(--primary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #0d625e 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(13, 98, 94, 0.2)',
                }}
              >
                {data.person.name.charAt(0)}
              </div>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                  {data.person.name}
                </h2>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {data.person.jobTitle ? `${data.person.jobTitle} • ` : ''}
                  {data.person.company || 'Individual Attendee'} • {data.person.email}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Ticket Reference
                </div>
                <code style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
                  {data.ticketCode}
                </code>
              </div>
              <div>
                {data.status === 'CHECKED_IN' ? (
                  <span className="badge badge-checked-in">CHECKED IN</span>
                ) : (
                  <span className="badge badge-confirmed">CONFIRMED</span>
                )}
              </div>
            </div>
          </div>

          {/* 9 Meals Entitlement Section */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🍱</span> 9 Meal Entitlements Matrix
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Day 1, Day 2, and Day 3 Breakfast, Lunch, and Dinner servings
                </p>
              </div>
              <span className="badge" style={{ background: 'var(--primary-subtle)', color: 'var(--primary)', border: '1px solid rgba(13, 98, 94, 0.2)' }}>
                {data.stats.mealsRedeemed} / {data.stats.mealsTotal} Redeemed
              </span>
            </div>

            <div className="matrix-grid">
              {data.meals.map((meal) => (
                <div
                  key={meal.id}
                  className={`matrix-item ${meal.status === 'REDEEMED' ? 'redeemed' : ''}`}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-heading)' }}>
                      {meal.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {meal.status === 'REDEEMED'
                        ? `Redeemed at ${new Date(meal.redeemedAt!).toLocaleTimeString()}`
                        : 'Available to redeem'}
                    </div>
                  </div>

                  <div>
                    {meal.status === 'REDEEMED' ? (
                      <span className="badge badge-redeemed">CLAIMED</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        disabled={redeemingCode === meal.code}
                        onClick={() => handleRedeem(meal.code)}
                      >
                        {redeemingCode === meal.code ? 'Redeeming...' : 'Redeem Meal'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 10 Sessions Entitlement Section */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🎤</span> 10 Sessions Access Matrix
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Keynotes, technical tracks, and specialized surgical workshops
                </p>
              </div>
              <span className="badge" style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--success-border)' }}>
                {data.stats.sessionsRedeemed} / {data.stats.sessionsTotal} Attended
              </span>
            </div>

            <div className="matrix-grid">
              {data.sessions.map((ses) => (
                <div
                  key={ses.id}
                  className={`matrix-item ${ses.status === 'REDEEMED' ? 'redeemed' : ''}`}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-heading)' }}>
                      {ses.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {ses.status === 'REDEEMED'
                        ? `Attended at ${new Date(ses.redeemedAt!).toLocaleTimeString()}`
                        : 'Access pass valid'}
                    </div>
                  </div>

                  <div>
                    {ses.status === 'REDEEMED' ? (
                      <span className="badge badge-redeemed">ATTENDED</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={redeemingCode === ses.code}
                        onClick={() => handleRedeem(ses.code)}
                      >
                        {redeemingCode === ses.code ? 'Logging...' : 'Grant Access'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
