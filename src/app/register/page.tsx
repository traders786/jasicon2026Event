'use client';

import { useState, useEffect, useRef } from 'react';
import { ParticipantBadge } from '@/components/ParticipantBadge';

interface EventItem {
  id: string;
  title: string;
  venue: string;
  logoUrl?: string | null;
}

interface NewBadgeResult {
  registration: {
    id: string;
    ticketCode: string;
    status: string;
    person: {
      id?: string;
      name: string;
      email: string;
      phone?: string | null;
      company: string | null;
      jobTitle?: string | null;
      photoUrl?: string | null;
    };
  };
  qrToken: string;
  qrDataUrl: string;
}

export default function RegisterPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [category, setCategory] = useState<'DELEGATE' | 'FACULTY' | 'PG STUDENT'>('DELEGATE');

  // Photo Capture & Camera State
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBadge, setCreatedBadge] = useState<NewBadgeResult | null>(null);

  useEffect(() => {
    fetch('/api/events')
      .then((res) => res.json())
      .then((data) => {
        if (data.events && data.events.length > 0) {
          setEvents(data.events);
          setSelectedEventId(data.events[0].id);
        }
      })
      .catch((err) => console.error('Failed to load events:', err));
  }, []);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Start webcam / camera stream
  const startCamera = async (targetMode: 'user' | 'environment' = facingMode) => {
    setCameraActive(true);
    setCameraLoading(true);
    setCameraError(null);

    // Stop existing stream if any
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    let stream: MediaStream | null = null;
    try {
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
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: targetMode },
          audio: false,
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Camera access error';
          setCameraError(`${msg}. Please allow camera permissions in your browser.`);
          setCameraLoading(false);
          return;
        }
      }
    }

    if (!stream) {
      setCameraError('Could not initialize camera stream.');
      setCameraLoading(false);
      return;
    }

    streamRef.current = stream;
    setCameraLoading(false);

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setCameraError(null);
  };

  // Capture frame from webcam and crop to square passport format
  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement('canvas');
    const size = 420; // 420x420 square crop for crisp printing
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vWidth = video.videoWidth;
    const vHeight = video.videoHeight;
    const minDim = Math.min(vWidth, vHeight);
    const startX = (vWidth - minDim) / 2;
    const startY = (vHeight - minDim) / 2;

    // Mirror image if front camera for natural orientation
    if (facingMode === 'user') {
      ctx.translate(size, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, startX, startY, minDim, minDim, 0, 0, size, size);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setPhotoData(dataUrl);
    stopCamera();
  };

  // Toggle front/rear camera
  const switchCamera = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      alert('Selected image must be under 8MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 420;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const minDim = Math.min(img.width, img.height);
        const startX = (img.width - minDim) / 2;
        const startY = (img.height - minDim) / 2;
        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        setPhotoData(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const formattedPhone = phone ? `+91${phone}` : undefined;

      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: selectedEventId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: formattedPhone,
          company: company.trim() || undefined,
          jobTitle: category,
          photoUrl: photoData || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setCreatedBadge(data);

      // Reset form fields
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setCompany('');
      setCategory('DELEGATE');
      setPhotoData(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const selectedEvent = events.find((ev) => ev.id === selectedEventId);

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      {/* Page Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span className="badge badge-available">● On-Spot Counter</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            JASICON 2026 Registration Desk
          </span>
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-heading)' }}>
          On-Spot Attendee Registration
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
          Register delegate on spot, snap their official badge photo, provision all 19 entitlements, and issue their digital &amp; physical badge.
        </p>
      </div>

      {error && (
        <div className="card" style={{ color: '#ef4444', border: '1px solid #fca5a5', background: '#fef2f2', padding: '1rem', borderRadius: '12px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Main Registration Card */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <form onSubmit={handleSubmit}>
          {/* ========================================================================= */}
          {/* PHOTO CAPTURE & AVATAR SECTION                                            */}
          {/* ========================================================================= */}
          <div
            style={{
              padding: '1.25rem',
              background: 'linear-gradient(135deg, rgba(13, 98, 94, 0.04) 0%, rgba(5, 150, 105, 0.06) 100%)',
              border: photoData ? '2px solid #10b981' : '1.5px dashed rgba(13, 98, 94, 0.3)',
              borderRadius: '16px',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1.5rem',
              flexWrap: 'wrap',
              transition: 'all 0.2s ease',
            }}
          >
            {/* Avatar Circle Preview */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div
                style={{
                  width: '92px',
                  height: '92px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  border: photoData ? '3px solid #10b981' : '2px dashed #cbd5e1',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {photoData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoData}
                    alt="Attendee"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ fontSize: '2.2rem', lineHeight: 1 }}>📷</div>
                    <div style={{ fontSize: '0.62rem', fontWeight: 800, marginTop: '2px', letterSpacing: '0.04em' }}>
                      NO PHOTO
                    </div>
                  </div>
                )}
              </div>

              {photoData && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '0px',
                    right: '0px',
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#10b981',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                    border: '2px solid #ffffff',
                  }}
                  title="Photo Ready for Badge"
                >
                  ✓
                </div>
              )}
            </div>

            {/* Photo Action Buttons */}
            <div style={{ flex: 1, minWidth: '240px' }}>
              <div style={{ fontWeight: 800, color: 'var(--text-heading)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Delegate Badge Photo</span>
                {photoData ? (
                  <span style={{ fontSize: '0.72rem', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '9999px', fontWeight: 700 }}>
                    ✓ Ready for Print
                  </span>
                ) : (
                  <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '9999px', fontWeight: 600 }}>
                    Optional
                  </span>
                )}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '4px 0 12px 0', lineHeight: 1.4 }}>
                {photoData
                  ? 'Photo captured successfully! It will be printed on the delegate badge card and saved to their profile.'
                  : 'Snap a live photo with your webcam or mobile camera to print directly on their physical conference badge.'}
              </p>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="btn btn-sm btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                >
                  <span>📷</span>
                  <span>{photoData ? 'Retake Photo' : 'Snap with Camera'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-sm btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <span>📁</span>
                  <span>Upload from File</span>
                </button>

                {photoData && (
                  <button
                    type="button"
                    onClick={() => setPhotoData(null)}
                    className="btn btn-sm"
                    style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
                    title="Remove photo"
                  >
                    ✕ Remove
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* Event Selection */}
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ fontWeight: 700 }}>Select Conference Event *</label>
            <select
              className="form-select"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              required
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} ({ev.venue})
                </option>
              ))}
            </select>
          </div>

          {/* First & Last Name */}
          <div className="form-grid-2" style={{ marginBottom: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 700 }}>First Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Dr. Rajesh"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 700 }}>Last Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Sharma"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Email & Phone */}
          <div className="form-grid-2" style={{ marginBottom: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 700 }}>Email Address *</label>
              <input
                type="email"
                className="form-input"
                placeholder="doctor@hospital.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 700 }}>Phone Number (10 Digits)</label>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.65rem 0.85rem',
                    background: '#f1f5f9',
                    border: '1px solid var(--border)',
                    borderRight: 'none',
                    borderRadius: '8px 0 0 8px',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: 'var(--text-heading)',
                    userSelect: 'none',
                  }}
                >
                  🇮🇳 +91
                </span>
                <input
                  type="tel"
                  className="form-input"
                  style={{ borderRadius: '0 8px 8px 0' }}
                  placeholder="9876543210"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setPhone(digits);
                  }}
                />
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                Used for instant digital badge dispatch via WhatsApp.
              </p>
            </div>
          </div>

          {/* Category & Institution */}
          <div className="form-grid-2" style={{ marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 700 }}>Doctor Category *</label>
              <select
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as 'DELEGATE' | 'FACULTY' | 'PG STUDENT')}
                required
              >
                <option value="DELEGATE">DELEGATE</option>
                <option value="FACULTY">FACULTY</option>
                <option value="PG STUDENT">PG STUDENT</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 700 }}>Institution / Hospital / City</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. AIIMS Deoghar / RIMS Ranchi"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
          </div>

          {/* Form Action Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ minWidth: '220px', padding: '0.75rem 1.5rem', fontSize: '0.98rem', fontWeight: 800 }}
            >
              {loading ? 'Registering & Generating Badge...' : '✓ Register & Generate Official Badge'}
            </button>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* CAMERA SNAP VIEWFINDER MODAL                                              */}
      {/* ========================================================================= */}
      {cameraActive && (
        <div
          className="profile-modal-overlay"
          onClick={() => stopCamera()}
          style={{ zIndex: 99999 }}
        >
          <div
            className="profile-modal-card"
            style={{ maxWidth: '540px', padding: '1.5rem', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button with red hover animation */}
            <button
              type="button"
              onClick={stopCamera}
              className="modal-top-close-btn"
              title="Close camera"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            <div style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                📷 Snap Attendee Photo
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Center the doctor&apos;s face in the circular viewfinder and click Capture.
              </p>
            </div>

            {cameraError && (
              <div style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5', padding: '10px', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                ⚠️ {cameraError}
              </div>
            )}

            {/* Video Preview Container with Passport Framing */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxHeight: '360px',
                borderRadius: '16px',
                overflow: 'hidden',
                background: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {cameraLoading && (
                <div style={{ color: '#ffffff', padding: '3rem', fontSize: '0.9rem' }}>
                  ⏳ Starting camera stream...
                </div>
              )}

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '340px',
                  objectFit: 'cover',
                  display: cameraLoading ? 'none' : 'block',
                  transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                }}
              />

              {/* Passport Face Guide Overlay */}
              {!cameraLoading && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '210px',
                      height: '210px',
                      borderRadius: '50%',
                      border: '3px dashed #10b981',
                      boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.45)',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Viewfinder Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '1.25rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={switchCamera}
                className="btn btn-secondary btn-sm"
                title="Switch Camera (Front/Rear)"
              >
                🔄 Switch Camera
              </button>

              <button
                type="button"
                onClick={capturePhoto}
                disabled={cameraLoading}
                className="btn btn-primary"
                style={{
                  minWidth: '160px',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <span>📸</span>
                <span>Capture Photo</span>
              </button>

              <button
                type="button"
                onClick={stopCamera}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INSTANT GENERATED BADGE PREVIEW & PRINT MODAL                              */}
      {/* ========================================================================= */}
      {createdBadge && (
        <div
          className="profile-modal-overlay"
          onClick={() => setCreatedBadge(null)}
          style={{ zIndex: 99999 }}
        >
          <div
            className="profile-modal-card"
            style={{ maxWidth: '840px', padding: '1.5rem', maxHeight: '92vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with success badge */}
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="badge badge-available">✓ Registration Complete</span>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-heading)', marginTop: '4px' }}>
                  Official Conference Badge Ready
                </h2>
              </div>
            </div>

            {/* Actual Full Badge Component with Photo and Print Engine */}
            <ParticipantBadge
              registrationId={createdBadge.registration.id}
              ticketCode={createdBadge.registration.ticketCode}
              status="CONFIRMED"
              category={category}
              event={{
                title: selectedEvent?.title || 'JASICON 2026',
                venue: selectedEvent?.venue || 'Deoghar, Jharkhand',
                logoUrl: selectedEvent?.logoUrl || null,
              }}
              person={{
                name: createdBadge.registration.person.name,
                email: createdBadge.registration.person.email,
                phone: createdBadge.registration.person.phone,
                company: createdBadge.registration.person.company,
                jobTitle: category,
                photoUrl: createdBadge.registration.person.photoUrl,
              }}
              qrDataUrl={createdBadge.qrDataUrl}
              onClose={() => setCreatedBadge(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
