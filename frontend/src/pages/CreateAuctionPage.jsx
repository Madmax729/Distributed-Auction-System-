import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auctionAPI, uploadAPI } from '../services/api';
import toast from 'react-hot-toast';

const DURATION_OPTIONS = [
  { value: '5',    label: '5 min' },
  { value: '15',   label: '15 min' },
  { value: '30',   label: '30 min' },
  { value: '60',   label: '1 hour' },
  { value: '360',  label: '6 hours' },
  { value: '1440', label: '24 hours' },
];

const CATEGORIES = ['Electronics', 'Art', 'Collectibles', 'Vehicles', 'Fashion', 'Sports', 'Books', 'Other'];

export default function CreateAuctionPage({ user }) {
  const navigate     = useNavigate();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    itemName:      '',
    description:   '',
    startingPrice: '',
    category:      'Other',
    duration:      '60',
    customEndTime: '',
    useCustomTime: false,
  });

  const [imageFile,    setImageFile]    = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading,    setUploading]    = useState(false);
  const [submitting,   setSubmitting]   = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ─── Validation ────────────────────────────────────────
    if (!user) {
      toast.error('Please set your username first');
      return;
    }
    if (!form.itemName.trim()) {
      toast.error('Item name is required');
      return;
    }

    const price = parseFloat(form.startingPrice);
    if (isNaN(price) || price <= 0) {
      toast.error('Starting price must be a number greater than 0');
      return;
    }

    // ─── End Time Calculation ───────────────────────────────
    let endTime;
    if (form.useCustomTime) {
      if (!form.customEndTime) {
        toast.error('Please pick a custom end time');
        return;
      }
      const customDate = new Date(form.customEndTime);
      if (isNaN(customDate.getTime())) {
        toast.error('Invalid end time format');
        return;
      }
      if (customDate <= new Date()) {
        toast.error('End time must be in the future');
        return;
      }
      endTime = customDate.toISOString();
    } else {
      const minutes = parseInt(form.duration) || 60;
      endTime = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    }

    // ─── Submit ─────────────────────────────────────────────
    try {
      setSubmitting(true);

      let imagePath = null;
      if (imageFile) {
        setUploading(true);
        try {
          const uploadRes = await uploadAPI.uploadImage(imageFile);
          imagePath = uploadRes.data.imagePath;
        } catch (err) {
          console.error('[CreateAuction] Image upload error:', err);
          toast.error('Image upload failed — continuing without image');
        } finally {
          setUploading(false);
        }
      }

      const payload = {
        itemName:      form.itemName.trim(),
        description:   form.description.trim(),
        category:      form.category || 'Other',
        startingPrice: price,
        endTime,
        userId:    user.userId,
        userName:  user.userName,
        imagePath,
      };

      console.log('[CreateAuction] Submitting:', payload);
      const res = await auctionAPI.create(payload);

      if (res.data?.auction?.auctionId) {
        toast.success(`Auction created! ID: ${res.data.auction.auctionId.slice(0, 8)}…`);
        navigate(`/auction/${res.data.auction.auctionId}`);
      } else {
        toast.error('Auction created but no ID returned');
        navigate('/');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.userMessage || err.message || 'Failed to create auction';
      toast.error(msg);
      console.error('[CreateAuction] Error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const sectionHead = {
    fontSize: 11, fontWeight: 700, color: 'var(--text-3)',
    letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 18,
  };

  return (
    <div className="container" style={{ paddingTop: 44, paddingBottom: 96 }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 32, animation: 'fadeIn 0.4s ease' }}>
          <h1 style={{
            fontSize: 26, fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6,
            color: 'var(--text-1)',
          }}>
            Create Auction
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
            Your auction will be distributed across all 4 server nodes in real time.
          </p>
        </div>

        {/* No-user warning */}
        {!user && (
          <div style={{
            background: 'var(--amber-dim)',
            border: '1px solid rgba(245,158,11,0.22)',
            borderRadius: 'var(--r-md)',
            padding: '11px 15px',
            fontSize: 13, color: 'var(--amber)',
            marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink: 0}}>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Set your username before creating an auction.
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Item Details */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={sectionHead}>Item Details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <div className="form-group">
                <label className="form-label" htmlFor="itemName">Item Name *</label>
                <input
                  id="itemName" name="itemName"
                  className="input-field"
                  type="text"
                  placeholder="e.g. Vintage Gibson Les Paul"
                  value={form.itemName}
                  onChange={handleChange}
                  maxLength={100}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="description">Description</label>
                <textarea
                  id="description" name="description"
                  className="input-field"
                  placeholder="Describe your item…"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  maxLength={500}
                  style={{ resize: 'vertical', minHeight: 76 }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'right' }}>
                  {form.description.length} / 500
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      className={`btn btn-sm ${form.category === cat ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setForm(prev => ({ ...prev, category: cat }))}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="startingPrice">Starting Price (USD) *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 13, top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-3)', fontSize: 14, pointerEvents: 'none',
                  }}>$</span>
                  <input
                    id="startingPrice" name="startingPrice"
                    className="input-field"
                    type="number"
                    style={{ paddingLeft: 26 }}
                    placeholder="100"
                    value={form.startingPrice}
                    onChange={handleChange}
                    min="1"
                    step="1"
                    required
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Duration */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={sectionHead}>Duration</div>

            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
              {DURATION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`btn btn-sm ${form.duration === opt.value && !form.useCustomTime ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setForm(prev => ({ ...prev, duration: opt.value, useCustomTime: false }))}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <label style={{
              display: 'flex', alignItems: 'center', gap: 9,
              cursor: 'pointer', fontSize: 13, color: 'var(--text-2)',
            }}>
              <input
                type="checkbox"
                id="useCustomTime" name="useCustomTime"
                checked={form.useCustomTime}
                onChange={handleChange}
                style={{ width: 14, height: 14, accentColor: 'var(--accent)' }}
              />
              Custom end time
            </label>

            {form.useCustomTime && (
              <div style={{ marginTop: 12 }}>
                <input
                  id="customEndTime" name="customEndTime"
                  className="input-field"
                  type="datetime-local"
                  value={form.customEndTime}
                  onChange={handleChange}
                  min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                />
              </div>
            )}
          </div>

          {/* Image */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={sectionHead}>
              Image <span style={{ fontWeight: 400, color: 'var(--text-3)', textTransform: 'none', letterSpacing: 0 }}>optional</span>
            </div>

            {imagePreview ? (
              <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                <img
                  src={imagePreview} alt="Preview"
                  style={{
                    width: '100%', maxHeight: 200, objectFit: 'cover',
                    borderRadius: 'var(--r-md)', display: 'block',
                    border: '1px solid var(--border)',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()}>
                    Change
                  </button>
                  <button type="button" className="btn btn-sm btn-danger" onClick={removeImage}>
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  border: '1px dashed var(--border-hover)',
                  borderRadius: 'var(--r-md)',
                  padding: '30px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 180ms ease',
                  background: 'var(--bg-raised)',
                }}
                onClick={() => fileInputRef.current?.click()}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.background  = 'var(--accent-dim)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border-hover)';
                  e.currentTarget.style.background  = 'var(--bg-raised)';
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.35, marginBottom: 8 }}>
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>Click to upload</p>
                <p style={{ fontSize: 11, color: 'var(--text-3)' }}>JPEG · PNG · WebP · Max 5 MB</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{ display: 'none' }}
            />
          </div>

          {/* Submit */}
          <button
            id="create-auction-submit-btn"
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={submitting || !user}
            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
          >
            {uploading  ? 'Uploading image…'  :
             submitting ? 'Creating auction…' :
                          'Launch Auction'}
          </button>

        </form>
      </div>
    </div>
  );
}
