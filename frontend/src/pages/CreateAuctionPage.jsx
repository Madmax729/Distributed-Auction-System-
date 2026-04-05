import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auctionAPI, uploadAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function CreateAuctionPage({ user }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    itemName: '',
    description: '',
    startingPrice: '',
    duration: '60', // minutes
    customEndTime: '',
    useCustomTime: false,
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      toast.error('Please set up your username first');
      return;
    }

    if (!form.itemName.trim()) {
      toast.error('Item name is required');
      return;
    }

    const price = parseFloat(form.startingPrice);
    if (!price || price < 0) {
      toast.error('Starting price must be a positive number');
      return;
    }

    try {
      setSubmitting(true);

      // Upload image if selected
      let imagePath = null;
      if (imageFile) {
        setUploading(true);
        try {
          const uploadRes = await uploadAPI.uploadImage(imageFile);
          imagePath = uploadRes.data.imagePath;
        } catch (err) {
          toast.error('Image upload failed, continuing without image');
        } finally {
          setUploading(false);
        }
      }

      // Calculate end time
      let endTime;
      if (form.useCustomTime && form.customEndTime) {
        endTime = new Date(form.customEndTime).toISOString();
      } else {
        const minutes = parseInt(form.duration) || 60;
        endTime = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      }

      const res = await auctionAPI.create({
        itemName: form.itemName.trim(),
        description: form.description.trim(),
        startingPrice: price,
        endTime,
        userId: user.userId,
        userName: user.userName,
        imagePath,
      });

      toast.success('🎉 Auction created successfully!');
      navigate(`/auction/${res.data.auction.auctionId}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create auction');
    } finally {
      setSubmitting(false);
    }
  };

  const DURATION_OPTIONS = [
    { value: '5', label: '5 minutes (Quick)' },
    { value: '15', label: '15 minutes' },
    { value: '30', label: '30 minutes' },
    { value: '60', label: '1 hour' },
    { value: '360', label: '6 hours' },
    { value: '1440', label: '24 hours' },
  ];

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40, animation: 'fadeIn 0.5s ease' }}>
          <h1 style={{
            fontSize: 40, fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 800, marginBottom: 12,
          }}>
            ✨ Create{' '}
            <span style={{
              background: 'linear-gradient(135deg, #6c63ff, #4facfe)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              Auction
            </span>
          </h1>
          <p style={{ color: 'rgba(240,240,255,0.45)', fontSize: 15 }}>
            Your auction will be distributed across all 4 server nodes in real time
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Main Card */}
          <div className="glass-card" style={{ padding: '36px 40px', marginBottom: 20 }}>
            {/* Item Name */}
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label className="form-label" htmlFor="itemName">Item Name *</label>
              <input
                id="itemName"
                name="itemName"
                className="input-field"
                type="text"
                placeholder="e.g. Vintage Gibson Les Paul Guitar"
                value={form.itemName}
                onChange={handleChange}
                maxLength={100}
                required
              />
            </div>

            {/* Description */}
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label className="form-label" htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                className="input-field"
                placeholder="Describe your item in detail..."
                value={form.description}
                onChange={handleChange}
                rows={4}
                maxLength={500}
                style={{ resize: 'vertical', minHeight: 100 }}
              />
              <span style={{ fontSize: 11, color: 'rgba(240,240,255,0.3)', textAlign: 'right' }}>
                {form.description.length}/500
              </span>
            </div>

            {/* Starting Price */}
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label className="form-label" htmlFor="startingPrice">Starting Price (USD) *</label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 16, top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'rgba(240,240,255,0.4)', fontSize: 16, fontWeight: 600,
                }}>$</span>
                <input
                  id="startingPrice"
                  name="startingPrice"
                  className="input-field"
                  type="number"
                  style={{ paddingLeft: 32 }}
                  placeholder="100"
                  value={form.startingPrice}
                  onChange={handleChange}
                  min="1"
                  step="1"
                  required
                />
              </div>
            </div>

            {/* Duration */}
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label className="form-label">Auction Duration *</label>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
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

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  id="useCustomTime"
                  name="useCustomTime"
                  checked={form.useCustomTime}
                  onChange={handleChange}
                  style={{ width: 16, height: 16, accentColor: '#6c63ff' }}
                />
                <label htmlFor="useCustomTime" style={{ fontSize: 13, color: 'rgba(240,240,255,0.6)', cursor: 'pointer' }}>
                  Custom end time
                </label>
              </div>

              {form.useCustomTime && (
                <input
                  id="customEndTime"
                  name="customEndTime"
                  className="input-field"
                  type="datetime-local"
                  value={form.customEndTime}
                  onChange={handleChange}
                  min={new Date().toISOString().slice(0, 16)}
                  style={{ marginTop: 10 }}
                />
              )}
            </div>
          </div>

          {/* Image Upload Card */}
          <div className="glass-card" style={{ padding: '28px 40px', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              📸 Item Image (Optional)
            </h3>

            <div
              style={{
                border: '2px dashed rgba(108, 99, 255, 0.3)',
                borderRadius: 12,
                padding: '32px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: imagePreview ? 'transparent' : 'rgba(108, 99, 255, 0.04)',
                position: 'relative',
                overflow: 'hidden',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <div>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 8, marginBottom: 12 }}
                  />
                  <p style={{ fontSize: 13, color: 'rgba(240,240,255,0.5)' }}>
                    Click to change image
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>🖼️</div>
                  <p style={{ fontSize: 14, color: 'rgba(240,240,255,0.5)', marginBottom: 4 }}>
                    Click to upload image
                  </p>
                  <p style={{ fontSize: 12, color: 'rgba(240,240,255,0.3)' }}>
                    JPEG, PNG, GIF, WebP • Max 5MB
                  </p>
                </div>
              )}
            </div>

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
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {uploading ? '⬆️ Uploading image...' : submitting ? '⏳ Creating...' : '🚀 Launch Auction'}
          </button>

          {!user && (
            <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(240,240,255,0.4)', marginTop: 12 }}>
              Please set your username to create an auction
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
