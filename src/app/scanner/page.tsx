'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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

export default function ScannerPage() {
  const [tokenInput, setTokenInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LookupResult | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [redeemingCode, setRedeemingCode] = useState<string | null>(null);

  // Mobile Camera Scanner State
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopActive = useRef<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Synthesize instant feedback beep for mobile scanning
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
    } catch {
      // Audio autoplay restrictions may ignore if silent
    }
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
    setTorchOn(false);
    setTorchSupported(false);
    setCameraActive(false);
  }, []);

  // Universal QR scan loop powered by jsQR + BarcodeDetector fallback
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

        // 1. Try native BarcodeDetector if available
        if (detector) {
          try {
            const barcodes = await detector.detect(video);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              detectedCode = barcodes[0].rawValue;
            }
          } catch {
            // Fallback to jsQR below
          }
        }

        // 2. Universal jsQR decoder (reliable on 100% of devices including iOS Safari)
        if (!detectedCode && canvasRef.current) {
          try {
            const canvas = canvasRef.current;
            // Downscale to 640px max dimension for 60fps performance on mobile CPUs
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
          playBeep();
          stopCamera();
          await handleLookup(detectedCode);
          return;
        }
      }

      if (scanLoopActive.current) {
        requestAnimationFrame(scanFrame);
      }
    };

    requestAnimationFrame(scanFrame);
  }, [handleLookup, playBeep, stopCamera]);

  const startCamera = async (mode: 'environment' | 'user' = facingMode) => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera API is not supported in this browser. Please ensure you are opening over HTTPS (Cloudflare) or localhost.');
      return;
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      let stream: MediaStream;
      try {
        // Preferred mobile rear camera with ideal HD
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        try {
          // Relaxed constraints fallback
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: mode },
            audio: false,
          });
        } catch {
          // Any available camera fallback
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      streamRef.current = stream;

      // Check if flashlight / torch is supported
      try {
        const track = stream.getVideoTracks()[0];
        const capabilities = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
        setTorchSupported(Boolean(capabilities?.torch));
      } catch {
        setTorchSupported(false);
      }

      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
      }

      scanLoopActive.current = true;
      startScanLoop();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera access error';
      setCameraError(`${msg}. Please grant camera permissions in your mobile browser settings.`);
      setCameraActive(false);
    }
  };

  const toggleFacingMode = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    if (cameraActive) {
      void startCamera(next);
    }
  };

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

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Title */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff' }}>
          QR Scanner & Entitlement Redemption Station
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
          Scan participant QR badge to verify check-in and atomically redeem meals and session passes.
        </p>
      </div>

      {/* Scanner Input Card */}
      <div className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Scan QR Badge or Enter Ticket Code:
            </label>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={cameraActive ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'}
                onClick={() => (cameraActive ? stopCamera() : void startCamera())}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span>{cameraActive ? '⏹ Stop Camera' : '📷 Mobile Camera Scanner'}</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => photoInputRef.current?.click()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span>📁 Snap / Upload Photo</span>
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
          {cameraActive && (
            <div
              style={{
                position: 'relative',
                background: '#020617',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '2px solid var(--primary)',
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  maxHeight: '360px',
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
                    width: '220px',
                    height: '220px',
                    border: '2px dashed rgba(99, 102, 241, 0.85)',
                    borderRadius: '16px',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '0',
                      right: '0',
                      height: '2px',
                      background: 'linear-gradient(90deg, transparent, #38bdf8, transparent)',
                      boxShadow: '0 0 8px #38bdf8',
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
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(8px)',
                  padding: '8px 12px',
                  borderRadius: '8px',
                }}
              >
                <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 600 }}>
                  Point camera at attendee QR badge
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {torchSupported && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={toggleTorch}
                      title="Toggle flashlight"
                    >
                      {torchOn ? '🔦 Torch On' : '💡 Torch'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={toggleFacingMode}
                  >
                    🔄 Flip Camera
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={stopCamera}
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
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: '0.85rem',
              }}
            >
              {cameraError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Scan QR code or enter ticket code (e.g. EC-2026-0008 or ec_tok_...)"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
              style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
            />
            <button
              onClick={() => handleLookup()}
              disabled={loading}
              className="btn btn-primary"
              style={{ minWidth: '150px' }}
            >
              {loading ? 'Verifying...' : 'Verify Attendee'}
            </button>
          </div>

          {/* Quick presets for local testing */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>
              Quick Test Presets:
            </span>
            {sampleAttendees.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleLookup(sample.token)}
              >
                {sample.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '10px',
            fontSize: '0.95rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            backgroundColor:
              feedback.type === 'success'
                ? 'rgba(16, 185, 129, 0.15)'
                : feedback.type === 'warning'
                ? 'rgba(245, 158, 11, 0.15)'
                : 'rgba(244, 63, 94, 0.15)',
            color:
              feedback.type === 'success'
                ? '#34d399'
                : feedback.type === 'warning'
                ? '#fbbf24'
                : '#f87171',
            border: `1px solid ${
              feedback.type === 'success'
                ? 'rgba(16, 185, 129, 0.3)'
                : feedback.type === 'warning'
                ? 'rgba(245, 158, 11, 0.3)'
                : 'rgba(244, 63, 94, 0.3)'
            }`,
          }}
        >
          <span>{feedback.type === 'success' ? '✓' : feedback.type === 'warning' ? '⚠' : '✕'}</span>
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Lookup Participant Details & Entitlement Grid */}
      {data && (
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
              borderLeft: '4px solid var(--primary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: '#fff',
                }}
              >
                {data.person.name.charAt(0)}
              </div>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff' }}>
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
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Ticket Reference
                </div>
                <code style={{ fontSize: '1.1rem', fontWeight: 700, color: '#818cf8' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🍱</span> 9 Meal Entitlements Matrix
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Day 1, Day 2, and Day 3 Breakfast, Lunch, and Dinner servings
                </p>
              </div>
              <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
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
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🎤</span> 10 Sessions Access Matrix
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Keynotes, technical tracks, and specialized workshops
                </p>
              </div>
              <span className="badge" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
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
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff' }}>
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
